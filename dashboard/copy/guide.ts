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
  { id: 'signin', title: 'Sign in', why: 'Connect your wallet, then sign a short message to prove it is yours. There is no password.', wallet: 'signMessage' },
  { id: 'register', title: 'Add your site', why: 'Enter your TapeOut site name, like 1.2.396.tape. TapeHermes checks that the wallet you signed in with owns it.' },
  { id: 'activate', title: 'Switch on your site', why: 'Turn on your site so apps can find it. Your wallet will show the cost before you pay.', wallet: 'transactions' },
  { id: 'secret', title: 'Save an API key', why: 'If the service you want to use gave you an API key, save it here. Skip this step if the service works without one.', optional: true },
  { id: 'route', title: 'Add an action', why: 'Set up an action like summarizing a document with an AI service. Choose what people can send and what to charge per summary. Use 0 to make it free.' },
  { id: 'delegation', title: 'Give signing permission', why: 'Let TapeHermes sign replies for your site until a date you choose. That signature helps apps check who sent the reply.', wallet: 'signTypedData' },
  { id: 'publish', title: 'Publish your API list', why: 'Put your list of actions and prices on X Layer so apps know what they can ask your site to do.', wallet: 'transactions' },
  { id: 'live', title: 'Your site is live', why: 'Open the Call Log to see what people ask your site to do. Renew signing permission before it expires.' },
]
