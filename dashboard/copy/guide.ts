/** The guided path for a first-time owner, in order. Each step says why it exists before it asks for anything. */
export interface GuideStep {
  id: 'signin' | 'register' | 'activate' | 'secret' | 'route' | 'delegation' | 'publish' | 'live'
  title: string
  why: string
  /** True when the step can be skipped (a route that needs no secret). */
  optional?: boolean
  /** What opens in the wallet, if anything. */
  wallet?: 'signMessage' | 'signTypedData' | 'transactions'
}

export const GUIDE_STEPS: GuideStep[] = [
  { id: 'signin', title: 'Sign in', why: 'Your wallet is your account. There is no password and no email.', wallet: 'signMessage' },
  { id: 'register', title: 'Add your site', why: 'Enter the name of a TapeOut site you hold on X Layer, for example 1.2.396.tape. We check on chain that your wallet is its current holder.' },
  { id: 'activate', title: 'Switch on your site', why: 'A new TapeOut site is off until its holder switches it on. While it is off, apps cannot find it. It takes one transaction from your wallet.', wallet: 'transactions' },
  { id: 'secret', title: 'Save a secret key', why: 'If the outside service needs an API key, save it here. It is encrypted, never shown again, and never sent to your visitors.', optional: true },
  { id: 'route', title: 'Create a route', why: 'A route is one call to an outside service that your site offers. You set the address, what visitors may send, and the price. Prices of zero make the route free.' },
  { id: 'delegation', title: 'Sign the delegation', why: 'Visitors need proof that answers really come from your site. You authorize our signing key for a set time, and your wallet signs it.', wallet: 'signTypedData' },
  { id: 'publish', title: 'Publish the manifest', why: 'The manifest lists your routes and prices and carries the delegation. Publishing writes it into your site on X Layer, so anyone can read it.', wallet: 'transactions' },
  { id: 'live', title: 'You are live', why: 'Your routes now answer. Use the call log to watch calls arrive. Renew the delegation before it ends.' },
]
