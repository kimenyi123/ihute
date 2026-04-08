/** Shared client + API validation: min length, mixed case, digit, symbol. */

const MIN_LEN = 10

export function getStrongPasswordError(password: string): string | null {
  const p = password ?? ""
  if (p.length < MIN_LEN) {
    return `Password must be at least ${MIN_LEN} characters`
  }
  if (!/[A-Z]/.test(p)) {
    return "Password must include at least one uppercase letter"
  }
  if (!/[a-z]/.test(p)) {
    return "Password must include at least one lowercase letter"
  }
  if (!/[0-9]/.test(p)) {
    return "Password must include at least one number"
  }
  if (!/[^A-Za-z0-9]/.test(p)) {
    return "Password must include at least one symbol (e.g. ! @ # $)"
  }
  return null
}
