export const SITE_TERMS = {
  secrets: {
    label: 'Keys',
    description: 'Store API keys for the services your actions use. For example, save your AI provider’s key so people can pay for a document summary without seeing the key.',
  },
  routes: {
    label: 'Actions',
    description: 'An action is something people can ask your site to do, like summarizing a document. You choose which service does the work and what to charge per call. In code, an action is called a route.',
  },
  delegation: {
    label: 'Permission',
    description: 'Let TapeHermes sign replies for your site until a date you choose. Apps use the signature to check where a reply came from. In code, this permission is called a delegation.',
  },
  manifest: {
    label: 'API List',
    description: 'Publish the list of actions apps can use, what each costs, and how to check your site’s replies. In code, this file is called a manifest.',
  },
  logs: {
    label: 'Call Log',
    description: 'See what people asked your site to do, whether it worked, what they paid, and how long it took. The history keeps no visitor details.',
  },
} as const
