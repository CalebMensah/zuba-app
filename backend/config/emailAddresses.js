export const EMAIL_SENDERS = {
  no_reply:  `Zuba <${process.env.EMAIL_NO_REPLY}>`,
  orders:    `Zuba Orders <${process.env.EMAIL_ORDERS}>`,
  payments:  `Zuba Payments <${process.env.EMAIL_PAYMENTS}>`,
  support:   `Zuba Support <${process.env.EMAIL_SUPPORT}>`,
  reminders: `Zuba <${process.env.EMAIL_REMINDERS}>`,
  disputes:  `Zuba Disputes <${process.env.EMAIL_DISPUTES}>`,
  escrow:    `Zuba Escrow <${process.env.EMAIL_ESCROW}>`,
};