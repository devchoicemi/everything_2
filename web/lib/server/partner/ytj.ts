/**
 * Finnish Business ID (Y-tunnus), format 1234567-8. The check digit is verified here; whether the business
 * actually exists is looked up in the Finnish trade register (YTJ, open data from the Patent and Registration
 * Office) and shown to the reviewer.
 */
export function normaliseBusinessId(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = /^\s*(\d{6,7})\s*-\s*(\d)\s*$/.exec(v)
  if (!m) return null
  return `${m[1].padStart(7, '0')}-${m[2]}`
}

/** The modulus-11 check digit: weights 7 9 10 5 8 4 2; remainder 0 gives 0, 1 is never issued. */
export function validBusinessId(id: string): boolean {
  const m = /^(\d{7})-(\d)$/.exec(id)
  if (!m) return false
  const weights = [7, 9, 10, 5, 8, 4, 2]
  const sum = [...m[1]].reduce((a, d, i) => a + Number(d) * weights[i], 0)
  const rem = sum % 11
  if (rem === 1) return false
  const check = rem === 0 ? 0 : 11 - rem
  return check === Number(m[2])
}

export interface YtjRecord {
  found: boolean
  name?: string
  status?: string
  form?: string
  registered?: string
  address?: string
  lookedUpAt: string
  /** true when the register could not be reached; the reviewer checks by hand */
  unavailable?: boolean
}

export async function lookupYtj(id: string): Promise<YtjRecord> {
  const lookedUpAt = new Date().toISOString()
  try {
    const res = await fetch(`https://avoindata.prh.fi/opendata-ytj-api/v3/companies?businessId=${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 404) return { found: false, lookedUpAt }
    if (!res.ok) return { found: false, unavailable: true, lookedUpAt }
    const data = (await res.json()) as { companies?: Record<string, unknown>[] }
    const c = data.companies?.[0] as
      | {
          names?: { name?: string; type?: string; endDate?: string | null }[]
          companyForms?: { descriptions?: { languageCode?: string; description?: string }[] }[]
          registrationDate?: string
          tradeRegisterStatus?: string
          addresses?: { street?: string; postCode?: string; postOffices?: { city?: string }[]; type?: number }[]
          status?: string
        }
      | undefined
    if (!c) return { found: false, lookedUpAt }
    const name = (c.names ?? []).find((n) => !n.endDate)?.name ?? c.names?.[0]?.name
    const form = c.companyForms?.[0]?.descriptions?.find((d) => d.languageCode === '3')?.description ?? c.companyForms?.[0]?.descriptions?.[0]?.description
    const a = c.addresses?.[0]
    return {
      found: true,
      name,
      status: c.status ?? c.tradeRegisterStatus,
      form,
      registered: c.registrationDate,
      address: a ? [a.street, [a.postCode, a.postOffices?.[0]?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : undefined,
      lookedUpAt,
    }
  } catch {
    return { found: false, unavailable: true, lookedUpAt }
  }
}
