from pathlib import Path
path = Path('lib/seller-register-i18n.ts')
text = path.read_text(encoding='utf-8')
old = '''  missingPhone: {
    en: "Enter a phone number.",
    rw: "Andika nimero ya telefoni.",
    fr: "Indiquez un numéro de téléphone.",
  },
'''
new = '''  missingPhone: {
    en: "Enter a phone number.",
    rw: "Andika nimero ya telefoni.",
    fr: "Indiquez un numéro de téléphone.",
  },
  invalidPhone: {
    en: "Enter a valid phone number with 10 to 12 digits.",
    rw: "Andika nimero ya telefoni ifite inshuro 10 kugera kuri 12.",
    fr: "Indiquez un numéro de téléphone valide de 10 à 12 chiffres.",
  },
'''
if old not in text:
    raise SystemExit('needle not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('patched')
