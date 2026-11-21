export interface SampleGigTemplate {
  id: string;
  label: string;
  clientName: string;
  summary: string;
  transcript: string;
}

export const SAMPLE_GIGS: SampleGigTemplate[] = [
  {
    id: 'jumia_trap',
    label: 'Simple Jumia App (₦150k Trap)',
    clientName: 'Chief Emeka (Lagos Retail)',
    summary: 'Client asks for a "simple Jumia app" in 2 weeks for ₦150k while casually expecting live rider tracking and Paystack escrow.',
    transcript: `[19/11/2026, 09:14] Chief Emeka: Good morning bro, my guy gave me your number from Yaba.
[19/11/2026, 09:16] Dev (Tunde): Good morning sir, glad to connect. How can I help?
[19/11/2026, 09:19] Chief Emeka: Nothing big o, we just want to build a simple Jumia app for Lagos and Abuja. Something clean that customers can order phones and groceries from.
[19/11/2026, 09:22] Dev (Tunde): Okay, is this a single store or multiple vendors? And do you have a budget or timeline in mind?
[19/11/2026, 09:25] Chief Emeka: Let vendors register and upload their items too so we collect small commission. Budget is 150k Naira sharp, we want to launch before end of month (2 weeks).
[19/11/2026, 09:27] Chief Emeka: Oh and of course when somebody orders, they should pay securely on the app with card or transfer and get instant receipt, plus track the dispatch rider live on map till it reaches their gate.
[19/11/2026, 09:30] Chief Emeka: Also add wallet system where customers can refund into wallet and buy airtime, and AI chat support so I don't hire customer care yet. Very simple stuff.`,
  },
  {
    id: 'logistics_mvp',
    label: 'Island Dispatch MVP (₦450k)',
    clientName: 'Adaeze (Lekki Logistics)',
    summary: 'Focused 1-city delivery booking web app with clearer expectations, though push alerts and automated rider payouts are unbudgeted.',
    transcript: `[20/11/2026, 14:02] Adaeze: Hi, we run 6 dispatch bikes in Lekki/VI and need a clean booking portal for customers.
[20/11/2026, 14:05] Dev (Tunde): Nice! What features do you need in phase 1?
[20/11/2026, 14:08] Adaeze: Pickup & dropoff address form, automatic price by zone, Paystack checkout, and an admin screen where our dispatcher assigns a rider manually.
[20/11/2026, 14:11] Adaeze: Budget is 450k and we can do 4 weeks. Later we might want WhatsApp status bot and live GPS map for riders, or maybe add live tracking now if it fits?`,
  },
];
