/** What the owner is told BEFORE a wallet window opens: what happens, what it costs, and what it cannot do. */
export interface WalletStepCopy {
  title: string
  whatHappens: string
  cost: string
  cannotDo: string
}

export const WALLET_STEPS = {
  signIn: {
    title: 'Sign in with your wallet',
    whatHappens: 'Your wallet will ask you to sign a short message. It proves you control this wallet. The message is good for one sign-in only.',
    cost: 'Free. No transaction is sent and no gas is used.',
    cannotDo: 'It cannot move funds or give anyone access to your tokens.',
  },
  switchChain: {
    title: 'Switch to X Layer',
    whatHappens: 'Your wallet will ask to switch to the X Layer network, because delegations and the manifest live there.',
    cost: 'Free.',
    cannotDo: 'Switching networks does not move anything.',
  },
  delegation: {
    title: 'Sign the delegation',
    whatHappens: 'Your wallet will show a typed message that names your site, the signing key we hold for it, and an end date. By signing, you allow that key to sign answers for your site until that date.',
    cost: 'Free to sign. Nothing is sent to the chain in this step.',
    cannotDo: 'It cannot move funds. It stops working on the end date, and also if the site changes hands.',
  },
  switchOn: {
    title: 'Switch on your site',
    whatHappens: 'Your wallet will open one transaction on X Layer that switches your site on for the number of months you chose. Until then, apps cannot find your site.',
    cost: 'You pay the activation price for each month. The chain sets it and your wallet shows it before you confirm. You also pay a small network fee in OKB.',
    cannotDo: 'It cannot move your tokens or change who holds the site. It stops working after the months you paid for, and then it has to be switched on again.',
  },
  publish: {
    title: 'Publish the manifest',
    whatHappens: 'Your wallet will open one or more transactions on X Layer that write the manifest file into your site. Apps and visitors read it from there. You confirm each one in your wallet.',
    cost: 'You pay network gas in OKB. Gas on X Layer is very low: a small manifest was measured at about 447,000 gas. A bigger manifest needs more.',
    cannotDo: 'It cannot move tokens or change who holds the site. It only writes one file to your site.',
  },
} satisfies Record<string, WalletStepCopy>
