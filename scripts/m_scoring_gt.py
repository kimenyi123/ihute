#!/usr/bin/env python3
# m_scoring_gt.py — GT payload using sales, purchases, bank statements, and financial_records
# Bank logic updated per user:
#   • Map "ALGORITHMMOMOFRW" → "MTN"
#   • If sumCount == 0 → credit/debit forced to 0
#   • Then halve each bank's summed credit/debit (suspected duplicates)
#   • Overall banking score = decile based on max(totalBankCredit,totalBankDebit)/sumSalesData
#   • Per-bank score via ratio to bank average (deciles, >1 ⇒ 10)
#
# Also includes: per-bank summary in scoreSummary, and totals/coverage metrics.

import argparse
import json
import logging
import os
import sys

import psycopg2
from statistics import pstdev
from calendar import month_name

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Port must be int for psycopg2
_db_port = os.getenv("DB_PORT")
DB = {
    "host": os.getenv("DB_HOST") or "localhost",
    "port": int(_db_port) if _db_port and str(_db_port).strip() else 5432,
    "dbname": os.getenv("DB_NAME") or "postgres",
    "user": os.getenv("DB_USER") or "postgres",
    "password": os.getenv("DB_PASSWORD") or "",
    "connect_timeout": 10,
}

COMPANY = {
    "sector": "software",
    "sector_avg_sales_monthly": 2_000_000.0,
    "sector_margin": 0.20,
    "product_type": "services",
}

# //TO CONNECT TO THE DB
EXISTENCE = {"staff_number": 7}
COMPLIANCE = {
    "rra_clearance": True,
    "psf_membership": True,
    "crb_active": True,
    "rssb_active": True,
    "tax_registered": True,
}


def get_connection():
    return psycopg2.connect(**DB)


def clip(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def month_seq(sm: int, sy: int, em: int, ey: int):
    y, m = sy, sm
    out = []
    while (y < ey) or (y == ey and m <= em):
        out.append((y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return out


def month_label(y: int, m: int) -> str:
    return f"{month_name[m]} {y}"


def map_bilan_to_bank(bilan: str):
    if not bilan:
        return None
    b = str(bilan).strip().upper()
    # Explicit mappings
    if b == "BANQUEBKFRW":
        return "BK"
    if b == "BANQUECOGEFRW":
        return "EQUITY"
    if b == "BANQUEGTFRW":
        return "GT"
    if b == "ALGORITHMMOMOFRW":
        return "MTN"
    # Heuristics / fallbacks
    if "BPR" in b:
        return "BPR"
    if "GUARANTY" in b or "GTB" in b or " GT" in b or b.startswith("GT"):
        return "GT"
    if "BANQUEBK" in b or " BK" in b or b.startswith("BK"):
        return "BK"
    if "EQUITY" in b or "COGE" in b or "EQB" in b:
        return "EQUITY"
    if "MTN" in b or "MOMO" in b:
        return "MTN"
    return None


def decile_score_from_pct(pct: float) -> int:
    """Overall banking score from coverage %; >90 => 10; 80–89=>9; ... 0–9=>0."""
    if pct > 90:
        return 10
    if pct >= 80:
        return 9
    if pct >= 70:
        return 8
    if pct >= 60:
        return 7
    if pct >= 50:
        return 6
    if pct >= 40:
        return 5
    if pct >= 30:
        return 4
    if pct >= 20:
        return 3
    if pct >= 10:
        return 2
    return 0


def per_bank_decile_from_ratio(r: float) -> int:
    """Per-bank score: ratio to bank average; >1 => 10; else decile floor (0..9)."""
    if r > 1.0:
        return 10
    val = int(r * 10)  # 0..9
    return max(0, min(9, val))


def compute_gt_payload(
    business_id: int,
    supplier_id: int,
    start_month: int,
    end_month: int,
    start_year: int,
    end_year: int,
    requested_loan_amount: float = 0.0,
) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Businesses: name + legacy statements
        cur.execute(
            """
            SELECT name, COALESCE(bpr_statement,0.0), COALESCE(gt_statement,0.0), COALESCE(bk_statement,0.0)
            FROM master.businesses WHERE id=%s
        """,
            (business_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Business id {business_id} not found")
        _business_name, bpr_stmt, gt_stmt, bk_stmt = row
        bpr_stmt = float(bpr_stmt)
        gt_stmt = float(gt_stmt)
        bk_stmt = float(bk_stmt)

        # Sales monthly (sum + sum(invoice_count))
        cur.execute(
            """
            SELECT year, month, COALESCE(SUM(sales_value),0) AS total, COALESCE(SUM(invoice_count),0) AS n_invoices
            FROM master.sales
            WHERE supplier_id=%s AND business_id=%s
              AND ((year>%s) OR (year=%s AND month>=%s))
              AND ((year<%s) OR (year=%s AND month<=%s))
            GROUP BY year, month ORDER BY year, month
        """,
            (supplier_id, business_id, start_year, start_year, start_month, end_year, end_year, end_month),
        )
        sales_rows = cur.fetchall()

        # Purchases monthly (sum + count(*))
        cur.execute(
            """
            SELECT year, month, COALESCE(SUM(po_value),0) AS total, COUNT(*) AS n_pos
            FROM master.purchases
            WHERE supplier_id=%s AND business_id=%s
              AND ((year>%s) OR (year=%s AND month>=%s))
              AND ((year<%s) OR (year=%s AND month<=%s))
            GROUP BY year, month ORDER BY year, month
        """,
            (supplier_id, business_id, start_year, start_year, start_month, end_year, end_year, end_month),
        )
        purch_rows = cur.fetchall()

        # Financial records monthly by bilan
        cur.execute(
            """
            SELECT period_year, period_month, bilan,
                   COALESCE(SUM(credit),0) AS total_credit,
                   COALESCE(SUM(debit),0)  AS total_debit,
                   COUNT(*) AS n_rows
            FROM master.financial_records
            WHERE business_id=%s
              AND ((period_year>%s) OR (period_year=%s AND period_month>=%s))
              AND ((period_year<%s) OR (period_year=%s AND period_month<=%s))
            GROUP BY period_year, period_month, bilan
            ORDER BY period_year, period_month, bilan
        """,
            (business_id, start_year, start_year, start_month, end_year, end_year, end_month),
        )
        fin_rows = cur.fetchall()

        # Time window
        months = month_seq(start_month, start_year, end_month, end_year)

        # Build per-bank aggregates from financial records
        bank_aggs = {}
        for (y, m, bilan, tc, td, n) in fin_rows:
            bank = map_bilan_to_bank(bilan)
            if not bank:
                continue
            d = bank_aggs.get(
                bank,
                {"sum_credit": 0.0, "sum_debit": 0.0, "sum_count": 0, "min": (9999, 99), "max": (0, 0), "months": set()},
            )
            d["sum_credit"] += float(tc)
            d["sum_debit"] += float(td)
            d["sum_count"] += int(n)
            ym = (int(y), int(m))
            d["months"].add(ym)
            if ym < d["min"]:
                d["min"] = ym
            if ym > d["max"]:
                d["max"] = ym
            bank_aggs[bank] = d

        # Totals for scoring
        sales_map = {(int(y), int(m)): (float(t), int(n)) for (y, m, t, n) in sales_rows}
        monthly_sales = [sales_map.get((y, m), (0.0, 0))[0] for (y, m) in months]
        total_sales = sum(monthly_sales)
        avg_sales_monthly = (total_sales / len(months)) if months else 0.0

        purch_map = {(int(y), int(m)): (float(t), int(n)) for (y, m, t, n) in purch_rows}
        total_purchases = sum(purch_map.get((y, m), (0.0, 0))[0] for (y, m) in months)

        # Ratio (services/goods)
        if total_purchases == 0 and COMPANY["product_type"].lower() == "services":
            ratio_score_10 = 10.0
        else:
            ratio = (total_sales / total_purchases) if total_purchases > 0 else None
            if ratio is None:
                ratio_score_10 = 5.0
            else:
                r = float(ratio)
                if 1.0 <= r <= 2.0:
                    ratio_score_10 = 10.0
                elif (0.8 <= r < 1.0) or (2.0 < r <= 2.5):
                    ratio_score_10 = 7.0
                elif (0.5 <= r < 0.8) or (2.5 < r <= 3.0):
                    ratio_score_10 = 4.0
                else:
                    ratio_score_10 = 1.0

        # Coverage: prefer fin_records total credits if any else legacy statements
        fin_total_credits = sum(d["sum_credit"] for d in bank_aggs.values()) if bank_aggs else 0.0
        sum_bank_for_coverage = fin_total_credits if fin_total_credits > 0 else (bpr_stmt + gt_stmt + bk_stmt)
        recon_cov = clip((sum_bank_for_coverage / total_sales) if total_sales > 0 else 0.0, 0.0, 1.0)
        bank_score_10 = round(10 * recon_cov, 1)

        # Stability
        stability_cov = 0.0
        if monthly_sales and len(monthly_sales) > 1 and avg_sales_monthly > 0:
            stability_cov = pstdev(monthly_sales) / avg_sales_monthly
        stability_score_10 = round(10.0 * (1.0 - clip(stability_cov, 0.0, 1.0)), 1)

        # Sector, margin
        ratio_to_sector = (avg_sales_monthly / COMPANY["sector_avg_sales_monthly"]) if COMPANY["sector_avg_sales_monthly"] > 0 else 1.0
        if ratio_to_sector >= 2.0:
            sector_score_10 = 10.0
        elif ratio_to_sector >= 1.0:
            sector_score_10 = round(5.0 + 5.0 * (ratio_to_sector - 1.0), 1)
        elif ratio_to_sector >= 0.5:
            sector_score_10 = round(2.0 + 3.0 * (ratio_to_sector - 0.5) / 0.5, 1)
        else:
            sector_score_10 = 1.0

        gm = ((total_sales - total_purchases) / total_sales) if total_sales > 0 else 0.0
        sector_margin = COMPANY["sector_margin"]
        margin_score_10 = 10.0 if gm >= sector_margin else round(10.0 * clip(gm / max(1e-9, sector_margin), 0.0, 1.0), 1)

        # Existence/Compliance
        Existence_Score = 20.0 if int(EXISTENCE.get("staff_number", 0)) > 2 else 0.0
        Compliance_Score = min(
            20.0,
            4.0
            * sum(
                1
                for k in ["rra_clearance", "psf_membership", "crb_active", "rssb_active", "tax_registered"]
                if COMPLIANCE.get(k, False)
            ),
        )

        components_10 = {
            "ratio": ratio_score_10,
            "bankCoverage": bank_score_10,
            "stability": stability_score_10,
            "sectorScale": sector_score_10,
            "margin": margin_score_10,
        }
        DataTransactionsInventory_Score = round((sum(components_10.values()) / 5.0) * 5.0, 1)

        Financials_Score = 10.0 if (fin_total_credits > 0 or bpr_stmt > 0 or gt_stmt > 0 or bk_stmt > 0) else 0.0
        TOTAL_SCORE = round(Existence_Score + Compliance_Score + DataTransactionsInventory_Score + Financials_Score, 1)
        grade = "A" if TOTAL_SCORE >= 85 else "B" if TOTAL_SCORE >= 75 else "C" if TOTAL_SCORE >= 65 else "D" if TOTAL_SCORE >= 50 else "E"
        mscore_score = round(TOTAL_SCORE / 10.0, 1)

        def advance_rate(g: str):
            return {"A": 0.50, "B": 0.40, "C": 0.30, "D": 0.15}.get(g, 0.0)

        adv_rate = advance_rate(grade)
        accepted_sales_monthly = avg_sales_monthly * recon_cov * clip(1.0 - stability_cov, 0.4, 1.0)
        loan_limit = accepted_sales_monthly * adv_rate * (mscore_score / 10.0)

        # ---------- Banking section with new scoring rules ----------
        def overall_period():
            return f"{month_label(start_year, start_month)} - {month_label(end_year, end_month)}"

        known = ["GT", "BPR", "BK", "EQUITY", "MTN"]
        discovered = [k for k in bank_aggs.keys() if k not in known]
        months_in_window = max(1, len(months))

        bankInfo = []
        per_bank_summary = []
        bank_amounts = []  # max(credit,debit) per bank after rules

        for bank_name in known + discovered:
            agg = bank_aggs.get(bank_name)
            period_range = overall_period()
            if agg:
                sum_credit = float(agg["sum_credit"])
                sum_debit = float(agg["sum_debit"])
                sum_count = int(agg["sum_count"])
                if agg["months"]:
                    y0, m0 = agg["min"]
                    y1, m1 = agg["max"]
                    period_range = f"{month_label(y0, m0)} - {month_label(y1, m1)}"
                months_active = len(agg["months"])
            else:
                # no financial rows for this bank
                sum_credit = 0.0
                sum_debit = 0.0
                sum_count = 0
                months_active = 0

            # Enforce rule: if count == 0 → zero out flows
            if sum_count == 0:
                sum_credit = 0.0
                sum_debit = 0.0

            # Halve flows (suspected duplicates)
            sum_credit *= 0.5
            sum_debit *= 0.5

            bank_amount = max(sum_credit, sum_debit)
            bank_amounts.append(bank_amount)

            bankInfo.append(
                {
                    "bankName": bank_name,
                    "score": 0.0,  # temporary, fill later with per-bank score
                    "data": [
                        {
                            "count": int(sum_count),
                            "totalValueDebit": float(sum_debit),
                            "totalValueCredit": float(sum_credit),
                            "period": period_range,
                        }
                    ],
                    "bankStatements": [{"file": ""}],
                }
            )

            per_bank_summary.append(
                {
                    "bankName": bank_name,
                    "sumCredit": float(sum_credit),
                    "sumDebit": float(sum_debit),
                    "sumCount": int(sum_count),
                    "monthsWindow": int(months_in_window),
                    "monthsActive": int(months_active),
                    "avgMonthly": float(sum_credit / months_in_window),  # using credit for avgMonthly display
                    "bankAmount": float(bank_amount),  # max(credit,debit)
                }
            )

        # Sales GT block (keep only positive count months)
        sales_rows_out = []
        for (y, m, total, n_inv) in sales_rows:
            if int(n_inv) > 0:
                sales_rows_out.append(
                    {"count": int(n_inv), "totalValue": float(total), "period": month_label(int(y), int(m))}
                )
        sales_rows_out = list(reversed(sales_rows_out))
        sales_blob = {"score": float(stability_score_10), "data": sales_rows_out}

        # Purchases GT block (keep only positive count months)
        purch_rows_out = []
        for (y, m, total, n_po) in purch_rows:
            if int(n_po) > 0:
                purch_rows_out.append(
                    {"count": int(n_po), "totalValue": float(total), "period": month_label(int(y), int(m))}
                )
        purch_rows_out = list(reversed(purch_rows_out))
        purchases_blob = {"score": 0.0, "data": purch_rows_out}

        # Financial records (grouped by bilan) with positive counts
        fin_rows_out = []
        for (y, m, bilan, tc, td, n) in fin_rows:
            if int(n) > 0:
                fin_rows_out.append(
                    {
                        "bilan": str(bilan),
                        "count": int(n),
                        "totalValueCredit": float(tc),
                        "totalValueDebit": float(td),
                        "period": month_label(int(y), int(m)),
                    }
                )
        fin_rows_out = sorted(fin_rows_out, key=lambda r: (r["period"], r["bilan"]), reverse=True)
        financial_blob = {"data": fin_rows_out}

        # ---- Totals & overall banking score ----
        sum_sales_data = sum(r["totalValue"] for r in sales_rows_out)
        total_bank_credit = sum(b["sumCredit"] for b in per_bank_summary)
        total_bank_debit = sum(b["sumDebit"] for b in per_bank_summary)
        total_bank_count = sum(b["sumCount"] for b in per_bank_summary)
        max_flow = max(total_bank_credit, total_bank_debit)
        coverage_pct = (max_flow / sum_sales_data * 100.0) if sum_sales_data > 0 else 0.0
        overall_bank_score = decile_score_from_pct(coverage_pct)

        # ---- Per-bank decile scores using average of bankAmount ----
        nbanks = len([b for b in per_bank_summary if (b["sumCount"] > 0 or b["sumCredit"] > 0 or b["sumDebit"] > 0)])
        bank_avg_amount = (sum(bank_amounts) / max(1, nbanks)) if nbanks > 0 else 1.0
        for i, entry in enumerate(per_bank_summary):
            amt = entry["bankAmount"]
            ratio = (amt / bank_avg_amount) if bank_avg_amount > 0 else 0.0
            score = per_bank_decile_from_ratio(ratio)
            entry["ratioVsBankAvg"] = float(ratio)
            entry["bankScore"] = int(score)
            bankInfo[i]["score"] = int(score)

        invoice_amount = float(requested_loan_amount)
        invoice_blob = {
            "currency": "RWF",
            "invoiceAmount": invoice_amount,
            "invoiceDetails": [
                {
                    "itemName": "Loan request",
                    "unitPrice": invoice_amount,
                    "quantite": 1,
                    "taxCode": "",
                    "category": COMPANY["sector"],
                    "tva": 0.0,
                    "lineAmount": invoice_amount,
                }
            ],
        }

        allowed_amount = min(invoice_amount, loan_limit)

        score_summary = {
            "formula": "TOTAL_SCORE = Existence_Score + Compliance_Score + DataTransactionsInventory_Score + Financials_Score",
            "bands": "A≥85, B=75–84, C=65–74, D=50–64, E<50",
            "Existence_Score": Existence_Score,
            "Compliance_Score": Compliance_Score,
            "DataTransactionsInventory_Score": DataTransactionsInventory_Score,
            "Financials_Score": Financials_Score,
            "TOTAL_SCORE": TOTAL_SCORE,
            "grade": grade,
            "mscore_score_rule": "mscore.score = round( TOTAL_SCORE / 10, 1 )",
            "mscore_score": mscore_score,
            "bank_coverage": round(recon_cov, 4),
            "stability_cov": round(stability_cov, 4),
            "advance_rate": adv_rate,
            "accepted_sales_monthly": round(accepted_sales_monthly, 2),
            "loan_limit": round(loan_limit, 2),
            "requested_loan_amount": round(invoice_amount, 2),
            "allowed_amount": round(allowed_amount, 2),
            "sumSalesData": round(sum_sales_data, 2),
            "sumBankCredit": round(total_bank_credit, 2),
            "sumBankDebit": round(total_bank_debit, 2),
            "sumBankCount": int(total_bank_count),
            "maxBankFlowVsSalesPct": round(coverage_pct, 2),
            "perBankSummary": per_bank_summary,
        }

        payload = {
            "requestedLoanAmount": invoice_amount,
            "buyerinfo": {"businessId": business_id, "buyerAccount": "", "sellerAccount": ""},
            "mscore": {"score": float(mscore_score), "loanLimit": float(loan_limit)},
            "contactInformation": {"data": [{"email": "", "location": "", "phone": "", "valueChain": COMPANY["sector"]}]},
            "loanRequestInvoice": invoice_blob,
            "inventoryData": {
                "score": 0.0,
                "data": [
                    {
                        "totalValueStock": 0.0,
                        "stockTakenTime": "",
                        "businessID": f"BUS{business_id:03d}",
                        "fastMovingCat": "",
                        "totalSKUs": 0,
                    }
                ],
            },
            "salesData": sales_blob,
            "purchasesData": purchases_blob,
            "financialRecords": financial_blob,
            "bankingInformation": {"score": int(overall_bank_score), "bankInfo": bankInfo},
            "scoreSummary": score_summary,
        }

        return payload

    except Exception as e:
        logger.error("Error: %s", e)
        raise
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--business_id", type=int, default=7931)
    ap.add_argument("--supplier_id", type=int, default=164989)
    ap.add_argument("--start_month", type=int, default=1)
    ap.add_argument("--end_month", type=int, default=12)
    ap.add_argument("--start_year", type=int, default=2024)
    ap.add_argument("--end_year", type=int, default=2024)
    ap.add_argument("--requested_loan_amount", type=float, default=2_000_000.0)
    args = ap.parse_args()

    print(
        json.dumps(
            compute_gt_payload(
                business_id=args.business_id,
                supplier_id=args.supplier_id,
                start_month=args.start_month,
                end_month=args.end_month,
                start_year=args.start_year,
                end_year=args.end_year,
                requested_loan_amount=args.requested_loan_amount,
            ),
            indent=2,
        )
    )
