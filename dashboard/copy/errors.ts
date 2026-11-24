import { ALLOWED_HEADERS } from '@/config/app'
import { ApiError } from '@/lib/api/errors'
import { translator, type Translate } from '@/lib/locale'

/** What the owner reads when something is refused: a short title, a plain sentence, and the technical text kept apart. */
export interface PlainError {
  title: string
  message: string
  /** The raw server text, shown only inside a "details" fold. */
  technical: string
}

/** The hosted rules give technical refusals. Each pattern here turns one into words an owner can act on. */
const ROUTE_REFUSALS: [RegExp, (m: RegExpMatchArray, t: Translate) => string][] = [
  [/https only|must be http\(s\)/i, () => 'The address must start with https://. Plain http is not allowed.'],
  [/port 443 only/i, () => 'Remove the port number from the address. Only the standard https port is allowed.'],
  [/user:password/i, () => 'The address cannot contain a user name or password.'],
  [/an IP address/i, () => 'Use a host name such as api.example.com, not an IP address.'],
  [/single-label host/i, () => 'The address needs a full host name with a dot, such as api.example.com.'],
  [/is not reachable from here/i, () => 'That host cannot be called from our servers. Local, internal and platform names are blocked.'],
  [/header (\S+) is not allowed here/i, (m, t) => t('The header "{0}" is not allowed. You can use: {1}.', m[1], ALLOWED_HEADERS.join(', '))],
  [/names (\d+) upstream hosts/i, (m, t) => t('This site would call {0} different outside hosts. The limit is 3.', m[1])],
  [/must not contain query/i, () => 'Do not put a question mark and values in the address. Add them in the Query section instead.'],
  [/must not place \{param\} in the origin/i, () => 'A {placeholder} can only appear in the path, never in the host name.'],
  [/must start with a full origin/i, () => 'The address must start with https:// and a full host name before any {placeholder}.'],
  [/bad header name/i, () => 'Header names can only contain letters, numbers and dashes.'],
  [/bad header value/i, () => 'A header value contains a character that is not allowed.'],
  [/escaped the configured prefix/i, () => 'A placeholder would change which address is called. Check the path.'],
]

const BY_CODE: Record<string, { title: string; message: string }> = {
  UNAUTHENTICATED: { title: 'Please sign in again', message: 'Your session ended. Sign in with your wallet to continue.' },
  SIGN_IN_FAILED: { title: 'Sign-in did not work', message: 'The wallet signature was not accepted. Try again, and make sure you sign with the wallet you connected.' },
  RATE_LIMITED: { title: 'Too many tries', message: 'Wait a moment and try again.' },
  SITE_NOT_FOUND: { title: 'No such site', message: 'That site name does not exist on X Layer, or it is not registered here.' },
  NOT_HOLDER: { title: 'This wallet is not the holder', message: 'Only the wallet that currently holds the site on X Layer can do this. Switch to that wallet.' },
  CHAIN_UNAVAILABLE: { title: 'X Layer could not be read', message: 'The chain did not answer. Nothing was changed. Try again in a minute.' },
  ROUTE_EXISTS: { title: 'That action name is taken', message: 'Choose another name, or edit the existing action.' },
  TOO_MANY_ROUTES: { title: 'Too many actions', message: 'A site can have up to 50 actions.' },
  ROUTE_NOT_FOUND: { title: 'Action not found', message: 'It may have been removed or renamed. Reload the page.' },
  SECRET_NOT_IN_HEADER: { title: 'API keys go in request headers', message: 'Put the key in a header value. Remove it from the address, query, body or fixed values.' },
  UNKNOWN_SECRET: { title: 'An API key is missing', message: 'This action uses an API key that is not saved. Save it under Keys first.' },
  SECRET_IN_USE: { title: 'An action still uses this API key', message: 'Remove the key from those actions first, or rename the key instead.' },
  SECRET_EXISTS: { title: 'That key name is taken', message: 'Choose another name.' },
  SECRET_NOT_FOUND: { title: 'API key not found', message: 'It was already removed. Reload the page.' },
  TOO_MANY_SECRETS: { title: 'Too many API keys', message: 'A site can save up to 20 API keys.' },
  LOCKED_SETTING_INVALID: { title: 'Check the fixed values for this action', message: '' },
  DELEGATION_SIGNATURE_MISMATCH: { title: 'The signature must come from the site owner', message: 'Set how long permission should last, then approve it with the wallet that owns this site.' },
  DELEGATION_SIGNATURE_INVALID: { title: 'The signature could not be read', message: 'Try signing again.' },
  DELEGATION_NOT_FROM_HOLDER: { title: 'The current owner needs to give permission', message: 'Open Permission and approve it with the wallet that owns this site now.' },
  NOT_ACTIVATED: { title: 'Your site is not switched on yet', message: 'Switch it on from the site page first, then publish.' },
  ALREADY_ACTIVE: { title: 'Your site is already switched on', message: 'Nothing to do. Reload the page to see the end date.' },
  NOT_PUBLISHABLE: { title: 'The API list is not ready to publish', message: 'Fix the points below, then try again.' },
  MANIFEST_INVALID: { title: 'The API list has a problem', message: 'Check your actions and prices, then try again.' },
  INVALID_SITE_FILES: { title: 'The site files are not valid', message: 'Build the bundle again with pnpm site:build and choose the new file.' },
  SITE_FILE_TOO_LARGE: { title: 'A site file is too large', message: 'Each file can hold up to 200,000 bytes.' },
  SITE_FILES_TOO_LARGE: { title: 'The website is too large', message: 'All files together can hold up to 400,000 bytes.' },
  NOT_ENOUGH_FOR_FEES: { title: 'Not enough OKB for the network fees', message: 'Add OKB to the holder wallet, or try again when the network fee is lower. Nothing was sent.' },
  NETWORK: { title: 'Cannot reach the server', message: 'Check your connection. If it keeps happening, the service may be down.' },
  BAD_ANSWER: { title: 'Unexpected answer', message: 'The server answered in a way this page does not understand. Reload the page.' },
}

/** The points of a NOT_PUBLISHABLE refusal, in words. */
export function explainProblem(problem: string): string {
  const [code] = problem.split(':')
  const known: Record<string, string> = {
    NO_ROUTES: 'Add at least one action and turn it on.',
    DELEGATION_REQUIRED: 'The wallet that owns this site has not given signing permission yet.',
    DELEGATION_EXPIRED: 'Signing permission has expired. Renew it on the Permission page.',
    MANIFEST_TOO_LARGE: 'The API list is too large. Turn off actions you don’t need or shorten their settings.',
  }
  return known[code] ?? problem
}

/** Turn any failure into plain words. Unknown codes still get a calm sentence and keep their technical text. */
export function explainError(e: unknown, t: Translate = translator('en')): PlainError {
  if (!(e instanceof ApiError)) return { title: 'Something went wrong', message: 'Try again. If it keeps happening, reload the page.', technical: e instanceof Error ? e.message : String(e) }
  const technical = `${e.status} ${e.code}: ${e.message}`
  if (e.code === 'ROUTE_REFUSED') {
    const hit = ROUTE_REFUSALS.map(([re, say]) => { const m = e.message.match(re); return m ? say(m, t) : null }).find(Boolean)
    return { title: 'This action could not be saved', message: hit ?? 'The settings break one of the hosted rules.', technical }
  }
  if (e.code === 'BAD_REQUEST' && Array.isArray(e.details.fields) && e.details.fields.length) {
    const fields = (e.details.fields as { field: string; problem: string }[]).map((f) => (f.field ? `${f.field}: ${f.problem}` : f.problem))
    return { title: 'Some values are not right', message: fields.join('. ') + '.', technical }
  }
  if (e.code === 'LOCKED_SETTING_INVALID') return { title: BY_CODE.LOCKED_SETTING_INVALID.title, message: e.message.replace(/^route \S+: /, ''), technical }
  const known = BY_CODE[e.code]
  if (known) return { ...known, technical }
  if (e.status === 0) return { ...BY_CODE.NETWORK, technical }
  if (e.status >= 500) return { title: 'The service had a problem', message: 'Nothing was changed. Try again in a moment.', technical }
  return { title: 'That did not work', message: e.message, technical }
}
