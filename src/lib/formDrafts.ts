const DRAFT_PREFIX = 'mycar_form_draft_v1:'
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000

export type FormDraft = {
  values: Record<string, string | boolean>
  savedAt: number
}

function storageKey(key: string) {
  return DRAFT_PREFIX + key
}

export function readFormDraft(key: string): FormDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as FormDraft
    if (!parsed || typeof parsed !== 'object' || !parsed.values || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(storageKey(key))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeFormDraft(key: string, values: Record<string, string | boolean>) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify({ values, savedAt: Date.now() } satisfies FormDraft))
  } catch {
    // Storage can be unavailable or full (for example, in private browsing).
  }
}

export function clearFormDraft(key: string) {
  try { localStorage.removeItem(storageKey(key)) } catch { /* ignore unavailable storage */ }
}

const NEVER_SAVE = new Set(['password', 'current_password', 'new_password', 'confirm_password', 'payment_proof', 'company_logo', 'vehicle_photos'])

export function captureFormValues(form: HTMLFormElement): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {}
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue
    const name = element.name
    if (!name || NEVER_SAVE.has(name.toLowerCase()) || element.disabled || element.type === 'file' || element.type === 'password' || element.type === 'hidden') continue
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      if (element.type === 'radio') {
        if (element.checked) values[name] = element.value
      } else values[name] = element.checked
      continue
    }
    values[name] = element.value
  }
  return values
}

export function restoreFormValues(form: HTMLFormElement, values: Record<string, string | boolean>) {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue
    const name = element.name
    if (!name || !(name in values) || NEVER_SAVE.has(name.toLowerCase()) || element.type === 'file' || element.type === 'password' || element.type === 'hidden') continue
    const value = values[name]
    if (element instanceof HTMLInputElement && element.type === 'radio') {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set
      setter?.call(element, String(value) === element.value)
    } else if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set
      setter?.call(element, value === true || value === 'on')
    } else {
      const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
      setter?.call(element, String(value))
    }
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }
}
