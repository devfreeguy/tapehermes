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
    whatHappens: 'Your wallet will ask to switch to the X Layer network, so it can make the changes on the network your site uses.',
    cost: 'Free.',
    cannotDo: 'Switching networks does not move anything.',
  },
  delegation: {
    title: 'Give signing permission',
    whatHappens: 'Your wallet shows your site, the key TapeHermes uses to sign replies, and the date permission ends. Check those details before approving.',
    cost: 'Free to sign. You are approving a message, so there is no network fee.',
    cannotDo: 'It cannot move funds. It stops working on the end date, and also if the site changes hands.',
  },
  switchOn: {
    title: 'Switch on your site',
    whatHappens: 'Your wallet will open one transaction on X Layer that switches your site on for the number of months you chose. Until then, apps cannot find your site.',
    cost: 'You pay the activation price for each month. The chain sets it and your wallet shows it before you confirm. You also pay a small network fee in OKB.',
    cannotDo: 'It cannot move your tokens or change who holds the site. It stops working after the months you paid for, and then it has to be switched on again.',
  },
  publish: {
    title: 'Publish your API list',
    whatHappens: 'Your wallet will ask you to approve one or more transactions. These save your API list to X Layer so apps can read it.',
    cost: 'You pay a network fee in OKB. Your wallet shows the fee for each transaction before you approve it.',
    cannotDo: 'It cannot move tokens or change who holds the site. It only writes one file to your site.',
  },
  publishSite: {
    title: 'Publish your website',
    whatHappens: 'Your wallet will ask you to approve several transactions, one after another. Each one saves part of your website to X Layer. Keep your wallet open until the last one is done.',
    cost: 'You pay a network fee in OKB for each transaction. The page checks that your wallet holds enough for the whole upload before it starts, and your wallet shows each fee before you approve it.',
    cannotDo: 'It cannot move tokens or change who holds the site. It only writes your website files. Anyone can read them, and they stay in the chain history.',
  },
} satisfies Record<string, WalletStepCopy>
