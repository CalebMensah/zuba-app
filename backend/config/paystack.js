import Paystack from 'paystack';

const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY);

export default paystack;
