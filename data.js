/* ===================== LANGUAGE ===================== */
function getLang(){
  const params = new URLSearchParams(window.location.search);
  const l = params.get('lang');
  return (l === 'fr') ? 'fr' : 'en';
}
function langUrl(targetLang){
  const url = new URL(window.location.href);
  url.searchParams.set('lang', targetLang);
  return url.pathname + url.search + url.hash;
}
function withLang(path){
  const l = getLang();
  return `${path}?lang=${l}`;
}

/* ===================== STORAGE (localStorage with in-memory fallback) ===================== */
const Storage = {
  _mem:{},
  get(key, fallback){
    try{
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    }catch(e){
      return (key in this._mem) ? this._mem[key] : fallback;
    }
  },
  set(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(e){
      this._mem[key] = value;
    }
  }
};

/* ===================== CART (in-progress selection, persisted locally per device) =====================
   Not a Firestore booking yet — just what the client is currently building on the Services page.
   Survives page navigation and refresh; clears itself after an hour of no activity. */
const CART_KEY = 'dmstyle_cart';
const CART_TTL_MS = 60 * 60 * 1000;
const Cart = {
  _empty(){ return { selected:[], date:'', time:null, savedAt:0 }; },
  read(){
    const raw = Storage.get(CART_KEY, null);
    if(!raw || !raw.savedAt) return this._empty();
    if(Date.now() - raw.savedAt > CART_TTL_MS) return this._empty();
    return raw;
  },
  write(partial){
    const next = { ...this.read(), ...partial, savedAt: Date.now() };
    Storage.set(CART_KEY, next);
    updateCartBadge();
    return next;
  },
  clear(){
    Storage.set(CART_KEY, this._empty());
    updateCartBadge();
  },
  count(){
    return this.read().selected.length;
  }
};
function updateCartBadge(){
  const badge = document.getElementById('cartBadge');
  if(!badge) return;
  const n = Cart.count();
  badge.textContent = n;
  badge.style.display = n > 0 ? 'flex' : 'none';
}

/* ===================== FIREBASE (shared, cross-device booking storage) =====================
   Paste your Firebase project's config below (Project settings → Your apps → SDK setup).
   Until this is filled in, the site quietly falls back to per-device localStorage so nothing breaks. */
const firebaseConfig = {
  apiKey: "AIzaSyCMEyjUA9Iu8tUIJ_4MwHa5OP0iMONWrQE",
  authDomain: "dm-style-studio.firebaseapp.com",
  projectId: "dm-style-studio",
  storageBucket: "dm-style-studio.firebasestorage.app",
  messagingSenderId: "713905472373",
  appId: "1:713905472373:web:e6add8d8bbf4107628093c"
};
let db = null;
try{
  if(firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY" && typeof firebase !== 'undefined'){
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  }
}catch(e){
  console.warn('Firebase not available — using local storage only.', e);
}

/* Bookings and blocked slots both go through these helpers. With `db` set, they read/write
   Firestore so every device sees the same data live; without it, they fall back to Storage
   so the site keeps working locally while Firebase is being set up. */
const Bookings = {
  async all(){
    if(!db) return Storage.get('dmstyle_bookings', []);
    try{
      const snap = await db.collection('bookings').get();
      return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    }catch(e){
      console.error('Bookings.all() failed:', e);
      return [];
    }
  },
  async add(booking){
    if(!db){
      const list = Storage.get('dmstyle_bookings', []);
      list.push(booking);
      Storage.set('dmstyle_bookings', list);
      return;
    }
    await db.collection('bookings').add({ ...booking, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  },
  async remove(id){
    if(!db) return;
    await db.collection('bookings').doc(id).delete();
  },
  async update(id, partial){
    if(!db) return;
    await db.collection('bookings').doc(id).update(partial);
  }
};
const Blocked = {
  async all(){
    if(!db) return Storage.get('dmstyle_blocked', []);
    try{
      const snap = await db.collection('blocked').get();
      return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    }catch(e){
      console.error('Blocked.all() failed:', e);
      return [];
    }
  },
  async add(entry){
    if(!db){
      const list = Storage.get('dmstyle_blocked', []);
      list.push(entry);
      Storage.set('dmstyle_blocked', list);
      return;
    }
    await db.collection('blocked').add({ ...entry, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  },
  async remove(id){
    if(!db) return;
    await db.collection('blocked').doc(id).delete();
  }
};

/* ===================== CONTACT ===================== */
const PHONE_TEL = '+16132423352';
const WHATSAPP_NUMBER = '16132423352';
const STUDIO_EMAIL = 'divinamiguelkanda@gmail.com';
const INSTAGRAM_URL = 'https://www.instagram.com/dmstyle02?igsh=ZDl4MnZ1aWszNXR3&utm_source=qr';
const TIKTOK_URL = 'https://www.tiktok.com/@dm_style01?_r=1&_t=ZP-98bYer6y5D4'; // TODO: replace with the real TikTok link
const FACEBOOK_URL = 'https://www.facebook.com/share/1GDmeuvy5a/?mibextid=wwXIfr'; // TODO: replace with the real Facebook link
const WHATSAPP_PRESET_MSG = {
  en: "Hi DM Style Studio, I'd like to ask about an appointment.",
  fr: "Bonjour DM Style Studio, j'aimerais me renseigner au sujet d'un rendez-vous."
};
const STAFF_PIN = '01082026'; // client-side soft lock only — not real security, see manage.html

/* ===================== I18N ===================== */
const I18N = {
  en: {
    navHome:"Home", navStudio:"Studio", navServices:"Services", navContact:"Contact", navBook:"Book Appointment", navCheck:"Check Appointment",
    heroHeadline:'Hi, <em>Beautiful.</em>',
    heroWelcome:'Welcome to <img src="images/logo-dm-mark.png" alt="DM" class="hero-dm-mark"> Style Studio',
    heroLede:"Where beauty meets confidence and every detail is created with intention.",
    heroCta1:"Book Your Appointment", heroCta2:"Our Approach",
    philosophyEyebrow:"Our Philosophy", philosophyTitle:"Where your beauty is styled with intention.",
    philosophyLede:"At DM Style, we believe your hair is more than just a style — it's part of how you express yourself. Our goal is to create beautiful, long-lasting looks while making sure you feel comfortable, confident, and truly taken care of.<br><br>From the moment you book your appointment to the final touch, we're committed to giving you an experience that feels just as beautiful as the results.<br><br>Whether you're coming in for a fresh new look, a protective style, or simply some well-deserved self-care, you're always welcome here.<br><br>Come as you are. Leave feeling confident, beautiful, and ready to shine.",
    pillar1Title:"Considered Craft", pillar1Body:"Every service starts with a consultation, so what you leave with is exactly what you asked for.",
    pillar2Title:"Quality Materials", pillar2Body:"We use professional-grade, texture-conscious products suited to your hair's needs, not a one-size approach.",
    pillar3Title:"An Unhurried Chair", pillar3Body:"Appointments are paced generously — no service is rushed to make room for the next.",
    teaserServicesTitle:"Browse Services & Book", teaserServicesBody:"Explore every service, build your appointment, and pick your date and time.",
    teaserContactTitle:"Get In Touch", teaserContactBody:"Questions, group bookings, or anything else — reach us by form, call, or WhatsApp.",
    teaserGo:"Go there",
    bookEyebrow:"Reserve Your Visit", bookTitle:"Build your appointment",
    bookLede:"Choose one or more services below — everything you select appears in your appointment summary on the right.",
    ticketTitle:"Your Appointment", ticketEmpty:"No services selected yet. Add a service from the list to begin.",
    estDuration:"Estimated duration", estTotal:"Estimated total",
    prefDate:"Preferred date", prefTime:"Preferred time",
    fullName:"Full name", emailLabel2:"Email", phoneLabel2:"Phone",
    requestAppt:"Request Appointment",
    ticketNote:"This confirms your request. A $25 non-refundable deposit is required to confirm your appointment — our studio will follow up with payment details.",
    contactEyebrow:"Get In Touch", contactTitle:"We'd love to hear from you.",
    contactLede:"Questions about a service, a group booking, or something we haven't listed? Send us a note, call, or message us on WhatsApp.",
    studioLabel:"Studio", phoneLabel:"Phone", emailLabel:"Email", hoursLabel:"Hours",
    hoursValue:"Mon – Fri: 10:00 AM – 7:00 PM", hoursMuted:"Sat: 9:30 AM – 9:00 PM",
    depositLabel:"Deposit", depositValue:`A $25 non-refundable deposit is required to confirm your appointment, sent by Interac e-Transfer to ${STUDIO_EMAIL}.`,
    callBtn:"Call Us", whatsappBtn:"WhatsApp", checkApptBtn:"Check My Appointment",
    footerRights:"All rights reserved.",
    checkModalTitle:"Check My Appointment", checkModalSub:"Enter the email you used when booking to see your appointment on this device.",
    lookupBtn:"Look Up",
    noResults:"We couldn't find an appointment under that email on this device.",
    fallbackText:"For appointment status, call or message us directly and we'll help right away.",
    itemsWord:"items", itemWord:"item",
    minWord:"min", hrWord:"hr",
    confirmedTitle:(name)=>`Request received, ${name}.`,
    confirmedBody:(count,dateStr,time)=>`${count} service${count>1?'s':''} requested for ${dateStr} at ${time}. We'll confirm by email shortly.`,
    startOver:"Start a New Booking",
    notifyStaffIntro:"Let us know however's easiest for you:",
    notifyStaffBtn:"WhatsApp",
    notifyTextBtn:"Text",
    notifyEmailBtn:"Email",
    notifyStaffMsg:(name,services,dateStr,time,phone)=>`New booking: ${name} — ${services} — ${dateStr} at ${time}${phone ? ' — ' + phone : ''}`,
    depositReminderConfirm:(email)=>`Reminder: a $25 non-refundable deposit confirms your appointment — send it by Interac e-Transfer to ${email}.`,
    lookupResultFor:(count)=>`${count} appointment${count!==1?'s':''} found`,
    selectOption:"Choose a length",
    slotLegendOpen:"Available", slotLegendTaken:"Unavailable",
    pickDateFirst:"Pick a date to see available times.",
    closedThisDay:"We're closed that day — please pick another date.",
    slotsLoadError:"Something went wrong loading times — please refresh the page and try again.",
    manageTitle:"Studio Availability", manageSub:"Manage bookings and blocked times — synced live across every device, whether booked by a client or added by staff.",
    pinTitle:"Staff Access", pinSub:"Enter the staff PIN to manage availability.",
    pinPlaceholder:"PIN", pinButton:"Unlock", pinError:"Incorrect PIN, please try again.",
    staffCalendarTitle:"Day Availability", staffCalendarSub:"Pick a date to see every time slot. Tap an open slot to block it, a blocked slot to reopen it, or a booked slot to cancel it.",
    pickStaffDate:"Select a date", loadingSlots:"Loading…",
    slotAvailable:"Available", slotBooked:"Booked", slotBlocked:"Blocked",
    workerLabel:(n)=>`Worker ${n}`,
    lockNamePrompt:"Your name (so the team knows who locked this):",
    acceptBookingBtn:"Accept", acceptedByPrefix:"✓ Accepted by",
    acceptNamePrompt:"Your name (so your colleague knows you've got this):",
    cancelNamePrompt:"Your name (so we know who cancelled this):",
    cancelReasonPrompt:"Reason for cancelling:",
    cancelledLabel:"Cancelled",
    cancelBookingBtn:"Cancel Appointment",
    clientCancelConfirm:"Cancel this appointment? Note: if you've already paid your $25 deposit, it is non-refundable.",
    clientCancelReasonPrompt:"Reason for cancelling (optional):",
    dayBookingsTitle:"Bookings for this day",
    manualBookingTitle:"Add a Manual Booking", manualBookingSub:"Add an appointment taken by phone, in person, or elsewhere — it will appear in the calendar above and count toward availability.",
    manFullName:"Client name", manPhoneLabel:"Phone", manServiceLabel:"Service", manDateLabel:"Date", manTimeLabel:"Time",
    manServicePlaceholder:"Choose a service…", manTimeTakenSuffix:"— booked", manTimePastSuffix:"— past",
    manSubmit:"Add Booking", manFillRequired:"Please fill in the client name, service, date, and time.", manSuccess:"Booking added.",
    slotConflict:"That time was just taken by another booking — please pick a different time.",
    pastTimeError:"That time has already passed — please pick another.",
    referenceCalendarTitle:"Studio Google Calendar (reference)", referenceCalendarSub:"Your personal Google Calendar, kept here for reference. It is not linked to the availability grid above.",
    openInGoogle:"Open in Google Calendar",
    firebaseNotConfigured:"Shared online storage isn't set up yet, so bookings and blocked slots below are only saved on this device/browser, not shared with clients or other staff devices. Paste your Firebase config into data.js to turn on live, shared syncing everywhere.",
  },
  fr: {
    navHome:"Accueil", navStudio:"Studio", navServices:"Services", navContact:"Contact", navBook:"Prendre rendez-vous", navCheck:"Vérifier un rendez-vous",
    heroHeadline:'Salut, <em>Beauté.</em>',
    heroWelcome:'Bienvenue chez <img src="images/logo-dm-mark.png" alt="DM" class="hero-dm-mark"> Style Studio',
    heroLede:"Là où la beauté rencontre la confiance, et où chaque détail est créé avec intention.",
    heroCta1:"Prendre rendez-vous", heroCta2:"Notre approche",
    philosophyEyebrow:"Notre philosophie", philosophyTitle:"Où votre beauté est stylisée avec intention.",
    philosophyLede:"Chez DM Style, nous croyons que vos cheveux sont bien plus qu'un style — ils font partie de la façon dont vous vous exprimez. Notre objectif est de créer des looks magnifiques et durables, tout en veillant à ce que vous vous sentiez à l'aise, confiante et vraiment prise en charge.<br><br>Du moment où vous réservez votre rendez-vous jusqu'à la touche finale, nous nous engageons à vous offrir une expérience aussi belle que le résultat.<br><br>Que vous veniez pour un nouveau look, une coiffure protectrice, ou simplement pour un moment de soin bien mérité, vous êtes toujours la bienvenue ici.<br><br>Venez comme vous êtes. Repartez confiante, belle et prête à briller.",
    pillar1Title:"Un savoir-faire réfléchi", pillar1Body:"Chaque service débute par une consultation, pour que le résultat corresponde exactement à votre demande.",
    pillar2Title:"Des produits de qualité", pillar2Body:"Nous utilisons des produits professionnels adaptés à votre texture de cheveux, sans approche universelle.",
    pillar3Title:"Un rendez-vous sans précipitation", pillar3Body:"Les rendez-vous sont espacés généreusement — aucun service n'est précipité pour faire place au suivant.",
    teaserServicesTitle:"Voir les services et réserver", teaserServicesBody:"Explorez chaque service, composez votre rendez-vous, et choisissez votre date et heure.",
    teaserContactTitle:"Contactez-nous", teaserContactBody:"Questions, réservations de groupe, ou autre — écrivez-nous, appelez-nous, ou contactez-nous sur WhatsApp.",
    teaserGo:"Y aller",
    bookEyebrow:"Réservez votre visite", bookTitle:"Composez votre rendez-vous",
    bookLede:"Choisissez un ou plusieurs services ci-dessous — tout ce que vous sélectionnez apparaît dans le résumé à droite.",
    ticketTitle:"Votre rendez-vous", ticketEmpty:"Aucun service sélectionné pour l'instant. Ajoutez un service dans la liste pour commencer.",
    estDuration:"Durée estimée", estTotal:"Total estimé",
    prefDate:"Date souhaitée", prefTime:"Heure souhaitée",
    fullName:"Nom complet", emailLabel2:"Courriel", phoneLabel2:"Téléphone",
    requestAppt:"Demander un rendez-vous",
    ticketNote:"Ceci confirme votre demande. Un dépôt non remboursable de 25$ est requis pour confirmer votre rendez-vous — notre studio vous contactera avec les détails de paiement.",
    contactEyebrow:"Contactez-nous", contactTitle:"Nous serions ravis de vous entendre.",
    contactLede:"Des questions sur un service, une réservation de groupe, ou autre chose? Envoyez-nous un message, appelez-nous, ou écrivez-nous sur WhatsApp.",
    studioLabel:"Studio", phoneLabel:"Téléphone", emailLabel:"Courriel", hoursLabel:"Horaire",
    hoursValue:"Lun – Ven : 10h00 – 19h00", hoursMuted:"Sam : 9h30 – 21h00",
    depositLabel:"Dépôt", depositValue:`Un dépôt non remboursable de 25$ est requis pour confirmer votre rendez-vous, envoyé par virement Interac à ${STUDIO_EMAIL}.`,
    callBtn:"Appelez-nous", whatsappBtn:"WhatsApp", checkApptBtn:"Vérifier mon rendez-vous",
    footerRights:"Tous droits réservés.",
    checkModalTitle:"Vérifier mon rendez-vous", checkModalSub:"Entrez le courriel utilisé lors de la réservation pour voir votre rendez-vous sur cet appareil.",
    lookupBtn:"Rechercher",
    noResults:"Nous n'avons trouvé aucun rendez-vous pour ce courriel sur cet appareil.",
    fallbackText:"Pour connaître le statut de votre rendez-vous, appelez-nous ou écrivez-nous directement — nous vous aiderons tout de suite.",
    itemsWord:"articles", itemWord:"article",
    minWord:"min", hrWord:"h",
    confirmedTitle:(name)=>`Demande reçue, ${name}.`,
    confirmedBody:(count,dateStr,time)=>`${count} service${count>1?'s':''} demandé${count>1?'s':''} pour le ${dateStr} à ${time}. Nous confirmerons par courriel sous peu.`,
    startOver:"Nouvelle réservation",
    notifyStaffIntro:"Avisez-nous de la façon qui vous convient :",
    notifyStaffBtn:"WhatsApp",
    notifyTextBtn:"Texto",
    notifyEmailBtn:"Courriel",
    notifyStaffMsg:(name,services,dateStr,time,phone)=>`Nouvelle réservation : ${name} — ${services} — ${dateStr} à ${time}${phone ? ' — ' + phone : ''}`,
    depositReminderConfirm:(email)=>`Rappel : un dépôt non remboursable de 25$ confirme votre rendez-vous — envoyez-le par virement Interac à ${email}.`,
    lookupResultFor:(count)=>`${count} rendez-vous trouvé${count!==1?'s':''}`,
    selectOption:"Choisissez une longueur",
    slotLegendOpen:"Disponible", slotLegendTaken:"Indisponible",
    pickDateFirst:"Choisissez une date pour voir les heures disponibles.",
    closedThisDay:"Nous sommes fermés ce jour-là — veuillez choisir une autre date.",
    slotsLoadError:"Une erreur s'est produite lors du chargement des heures — veuillez actualiser la page et réessayer.",
    manageTitle:"Disponibilité du studio", manageSub:"Gérez les rendez-vous et les créneaux bloqués — synchronisés en direct sur tous les appareils, qu'ils soient réservés par une cliente ou ajoutés par le personnel.",
    pinTitle:"Accès du personnel", pinSub:"Entrez le NIP du personnel pour gérer les disponibilités.",
    pinPlaceholder:"NIP", pinButton:"Déverrouiller", pinError:"NIP incorrect, veuillez réessayer.",
    staffCalendarTitle:"Disponibilité du jour", staffCalendarSub:"Choisissez une date pour voir tous les créneaux. Touchez un créneau disponible pour le bloquer, un créneau bloqué pour le rouvrir, ou un créneau réservé pour l'annuler.",
    pickStaffDate:"Sélectionnez une date", loadingSlots:"Chargement…",
    slotAvailable:"Disponible", slotBooked:"Réservé", slotBlocked:"Bloqué",
    workerLabel:(n)=>`Employé ${n}`,
    lockNamePrompt:"Votre nom (pour que l'équipe sache qui a verrouillé ceci) :",
    acceptBookingBtn:"Accepter", acceptedByPrefix:"✓ Accepté par",
    acceptNamePrompt:"Votre nom (pour que votre collègue sache que vous vous en occupez) :",
    cancelNamePrompt:"Votre nom (pour savoir qui a annulé ceci) :",
    cancelReasonPrompt:"Raison de l'annulation :",
    cancelledLabel:"Annulé",
    cancelBookingBtn:"Annuler le rendez-vous",
    clientCancelConfirm:"Annuler ce rendez-vous? Remarque : si vous avez déjà payé votre dépôt de 25$, il n'est pas remboursable.",
    clientCancelReasonPrompt:"Raison de l'annulation (facultatif) :",
    dayBookingsTitle:"Réservations de cette journée",
    manualBookingTitle:"Ajouter un rendez-vous manuel", manualBookingSub:"Ajoutez un rendez-vous pris par téléphone, en personne ou ailleurs — il apparaîtra dans le calendrier ci-dessus et comptera dans les disponibilités.",
    manFullName:"Nom de la cliente", manPhoneLabel:"Téléphone", manServiceLabel:"Service", manDateLabel:"Date", manTimeLabel:"Heure",
    manServicePlaceholder:"Choisissez un service…", manTimeTakenSuffix:"— réservé", manTimePastSuffix:"— passé",
    manSubmit:"Ajouter le rendez-vous", manFillRequired:"Veuillez remplir le nom, le service, la date et l'heure.", manSuccess:"Rendez-vous ajouté.",
    slotConflict:"Ce créneau vient d'être pris par une autre réservation — veuillez en choisir un autre.",
    pastTimeError:"Ce moment est déjà passé — veuillez en choisir un autre.",
    referenceCalendarTitle:"Google Agenda du studio (référence)", referenceCalendarSub:"Votre Google Agenda personnel, conservé ici à titre de référence. Il n'est pas lié à la grille de disponibilité ci-dessus.",
    openInGoogle:"Ouvrir dans Google Agenda",
    firebaseNotConfigured:"Le stockage partagé en ligne n'est pas encore configuré, donc les rendez-vous et créneaux bloqués ci-dessous ne sont enregistrés que sur cet appareil/navigateur, pas partagés avec les clientes ou les autres appareils du personnel. Collez votre configuration Firebase dans data.js pour activer la synchronisation partagée en direct partout.",
  }
};

/* ===================== SERVICES ===================== */
/* Each service has `options`: an array of variants.
   A "simple" service has a single option with label=null. */
/* ---- shared note sets ---- */
const NOTE_STD = {
  en:['Make sure to wash and blow dry your hair, otherwise there will be a cost.','The hair should have no product (oils, etc.)','Extensions are not included in the price.'],
  fr:["Assurez-vous de laver et sécher vos cheveux au séchoir, sinon des frais s'appliqueront.","Les cheveux ne doivent avoir aucun produit (huiles, etc.)","Les extensions ne sont pas incluses dans le prix."]
};
const NOTE_NOEXT = {
  en:['Make sure to wash and blow dry your hair, otherwise there will be a cost.','The hair should have no product (oils, etc.)'],
  fr:["Assurez-vous de laver et sécher vos cheveux au séchoir, sinon des frais s'appliqueront.","Les cheveux ne doivent avoir aucun produit (huiles, etc.)"]
};
const NOTE_FULANI_STORE = {
  en:['Make sure to wash and blow dry your hair, otherwise there will be a cost.','The hair should have no product (oils, etc.)',"Extensions are not included in the price — you're welcome to bring your own, or purchase extensions in our store."],
  fr:["Assurez-vous de laver et sécher vos cheveux au séchoir, sinon des frais s'appliqueront.","Les cheveux ne doivent avoir aucun produit (huiles, etc.)","Les extensions ne sont pas incluses dans le prix — vous pouvez apporter les vôtres, ou en acheter dans notre boutique."]
};
const NOTE_PICKDROP = {
  en:["Clients with hair past the chin will have an additional $20+ charge, since longer hair takes more time and work to braid.",'Make sure to wash and blow dry your hair, otherwise there will be a cost.','The hair should have no product (oils, etc.)','Extensions are not included in the price.'],
  fr:["Les clientes dont les cheveux dépassent le menton auront des frais additionnels de 20$+, car les cheveux plus longs demandent plus de temps et de travail.","Assurez-vous de laver et sécher vos cheveux au séchoir, sinon des frais s'appliqueront.","Les cheveux ne doivent avoir aucun produit (huiles, etc.)","Les extensions ne sont pas incluses dans le prix."]
};

const SERVICES = [
  /* ---- French Curl ---- */
  { id:'fc1', cat:{en:'French Curl',fr:'French Curl'}, name:{en:'Medium Knotless French Curls Braids',fr:'Tresses Knotless French Curls (Moyennes)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Mid Back',fr:'Milieu du dos'}, duration:330, price:180},
      {label:{en:'Shoulder length',fr:'Longueur épaule'}, duration:240, price:160},
    ]
  },
  { id:'fc2', cat:{en:'French Curl',fr:'French Curl'}, name:{en:'Small French Curls Braids',fr:'Tresses French Curls (Petites)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Mid Back',fr:'Milieu du dos'}, duration:360, price:190},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:390, price:210},
      {label:{en:'Shoulder length',fr:'Longueur épaule'}, duration:300, price:170},
    ]
  },
  { id:'fc3', cat:{en:'French Curl',fr:'French Curl'}, name:{en:'Medium Boho French Curls',fr:'French Curls Boho (Moyennes)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Mid back',fr:'Milieu du dos'}, duration:360, price:190},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:420, price:215},
    ]
  },
  { id:'fc4', cat:{en:'French Curl',fr:'French Curl'}, name:{en:'Small Boho French Curls',fr:'French Curls Boho (Petites)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:360, price:180},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:420, price:220},
    ]
  },

  /* ---- Boho Knotless ---- */
  { id:'bk1', cat:{en:'Boho Knotless',fr:'Boho Knotless'}, name:{en:'Small Boho Knotless',fr:'Boho Knotless (Petites)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:420, price:240},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:390, price:215},
      {label:{en:'Mid back / Bra length',fr:'Milieu du dos / soutien-gorge'}, duration:360, price:190},
      {label:{en:'Shoulder length',fr:'Longueur épaule'}, duration:300, price:170},
    ]
  },
  { id:'bk2', cat:{en:'Boho Knotless',fr:'Boho Knotless'}, name:{en:'Medium Boho Knotless',fr:'Boho Knotless (Moyennes)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:540, price:230},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:420, price:200},
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:390, price:180},
      {label:{en:'Shoulder length',fr:'Longueur épaule'}, duration:360, price:160},
    ]
  },

  /* ---- Senegalese Twist ---- */
  { id:'st1', cat:{en:'Senegalese Twist',fr:'Vanilles Sénégalaises'}, name:{en:'Medium Senegalese Twist',fr:'Vanilles Sénégalaises (Moyennes)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Shoulder length',fr:'Longueur épaule'}, duration:240, price:150},
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:300, price:160},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:330, price:180},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:390, price:200},
    ]
  },
  { id:'st2', cat:{en:'Senegalese Twist',fr:'Vanilles Sénégalaises'}, name:{en:'Large Senegalese Twist',fr:'Vanilles Sénégalaises (Larges)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Mid back',fr:'Milieu du dos'}, duration:180, price:120},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:240, price:130},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:300, price:150},
    ]
  },
  { id:'st3', cat:{en:'Senegalese Twist',fr:'Vanilles Sénégalaises'}, name:{en:'Small Senegalese Twist',fr:'Vanilles Sénégalaises (Petites)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:390, price:160},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:450, price:190},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:480, price:220},
    ]
  },

  /* ---- Island Twist ---- */
  { id:'it1', cat:{en:'Island Twist',fr:'Island Twist'}, name:{en:'Small Island Twist',fr:'Island Twist (Petites)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Mid back',fr:'Milieu du dos'}, duration:330, price:180},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:390, price:215},
    ]
  },
  { id:'it2', cat:{en:'Island Twist',fr:'Island Twist'}, name:{en:'Medium Island Twist',fr:'Island Twist (Moyennes)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Shoulder',fr:'Épaule'}, duration:270, price:150},
      {label:{en:'Mid back',fr:'Milieu du dos'}, duration:285, price:160},
      {label:{en:'Waist',fr:'Taille'}, duration:330, price:190},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:420, price:210},
    ]
  },

  /* ---- Cornrows ---- */
  { id:'cr1', cat:{en:'Cornrows',fr:'Cornrows'}, name:{en:'Kids Natural Hair Cornrows',fr:'Cornrows cheveux naturels (Enfants)'}, desc:{en:'',fr:''}, notes:NOTE_NOEXT, options:[{label:null, duration:150, price:75}] },
  { id:'cr2', cat:{en:'Cornrows',fr:'Cornrows'}, name:{en:'Under-Wig Cornrows (Small)',fr:'Cornrows sous perruque (Petites)'}, desc:{en:'',fr:''}, notes:NOTE_NOEXT, options:[{label:null, duration:90, price:50}] },
  { id:'cr3', cat:{en:'Cornrows',fr:'Cornrows'}, name:{en:'Under-Wig Cornrows (Medium)',fr:'Cornrows sous perruque (Moyennes)'}, desc:{en:'',fr:''}, notes:NOTE_NOEXT, options:[{label:null, duration:45, price:40}] },

  /* ---- Stitch Cornrows ---- */
  { id:'sc1', cat:{en:'Stitch Cornrows',fr:'Stitch Cornrows'}, name:{en:'6 Feed-In Stitch Braids',fr:'6 Stitch Braids Feed-In'}, desc:{en:'',fr:''}, notes:NOTE_STD, options:[{label:null, duration:150, price:100}] },
  { id:'sc2', cat:{en:'Stitch Cornrows',fr:'Stitch Cornrows'}, name:{en:'8 Feed-In Stitch Braids',fr:'8 Stitch Braids Feed-In'}, desc:{en:'',fr:''}, notes:NOTE_STD, options:[{label:null, duration:180, price:115}] },
  { id:'sc3', cat:{en:'Stitch Cornrows',fr:'Stitch Cornrows'}, name:{en:'10 Feed-In Stitch Braids',fr:'10 Stitch Braids Feed-In'}, desc:{en:'',fr:''}, notes:NOTE_STD, options:[{label:null, duration:180, price:130}] },

  /* ---- Fulani Braids ---- */
  { id:'fb1', cat:{en:'Fulani Braids',fr:'Tresses Fulani'}, name:{en:'Medium Limonade Fulani',fr:'Fulani Limonade (Moyennes)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Mid back',fr:'Milieu du dos'}, duration:300, price:160},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:330, price:180},
    ]
  },
  { id:'fb2', cat:{en:'Fulani Braids',fr:'Tresses Fulani'}, name:{en:'Small Limonade Fulani',fr:'Fulani Limonade (Petites)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:330, price:170},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:390, price:190},
    ]
  },
  { id:'fb3', cat:{en:'Fulani Braids',fr:'Tresses Fulani'}, name:{en:'Medium Fulani Braids',fr:'Tresses Fulani (Moyennes)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:270, price:140},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:330, price:160},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:390, price:175},
    ]
  },
  { id:'fb4', cat:{en:'Fulani Braids',fr:'Tresses Fulani'}, name:{en:'Small Fulani Braids',fr:'Tresses Fulani (Petites)'}, desc:{en:'',fr:''}, notes:NOTE_FULANI_STORE,
    options:[
      {label:{en:'Bra length / Mid Back',fr:'Soutien-gorge / milieu du dos'}, duration:330, price:150},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:390, price:180},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:420, price:190},
    ]
  },

  /* ---- Men's Hairstyles ---- */
  { id:'mh1', cat:{en:"Men's Hairstyles",fr:'Coiffures pour hommes'}, name:{en:"Men's Single Twist",fr:'Single Twist Homme'}, desc:{en:'',fr:''}, notes:NOTE_NOEXT, options:[{label:null, duration:120, price:70}] },
  { id:'mh2', cat:{en:"Men's Hairstyles",fr:'Coiffures pour hommes'}, name:{en:"Men's Stitch Cornrows",fr:'Stitch Cornrows Homme'}, desc:{en:'Price is for 6 cornrows.',fr:'Le prix est pour 6 cornrows.'}, notes:NOTE_NOEXT, options:[{label:null, duration:120, price:75}] },
  { id:'mh3', cat:{en:"Men's Hairstyles",fr:'Coiffures pour hommes'}, name:{en:"All-Back Simple Men's Cornrows",fr:"Cornrows simples vers l'arrière (Homme)"}, desc:{en:'',fr:''}, notes:NOTE_NOEXT, options:[{label:null, duration:60, price:50}] },
  { id:'mh4', cat:{en:"Men's Hairstyles",fr:'Coiffures pour hommes'}, name:{en:"Men's Cornrows with Simple Design",fr:'Cornrows avec motif simple (Homme)'}, desc:{en:'',fr:''}, notes:NOTE_NOEXT, options:[{label:null, duration:120, price:60}] },

  /* ---- Knotless Braids ---- */
  { id:'kb1', cat:{en:'Knotless Braids',fr:'Tresses Knotless'}, name:{en:'Large Knotless Braids',fr:'Tresses Knotless (Larges)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:150, price:120},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:180, price:140},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:240, price:150},
    ]
  },
  { id:'kb2', cat:{en:'Knotless Braids',fr:'Tresses Knotless'}, name:{en:'Medium Knotless Braids',fr:'Tresses Knotless (Moyennes)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Shoulder length',fr:'Longueur épaule'}, duration:240, price:140},
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:300, price:160},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:360, price:180},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:420, price:210},
      {label:{en:'Pass Butt',fr:'Longueur XL (sous fessier)'}, duration:510, price:230},
    ]
  },
  { id:'kb3', cat:{en:'Knotless Braids',fr:'Tresses Knotless'}, name:{en:'Small Knotless Braids',fr:'Tresses Knotless (Petites)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Shoulder length',fr:'Longueur épaule'}, duration:300, price:160},
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:300, price:180},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:360, price:200},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:420, price:230},
    ]
  },
  { id:'kb4', cat:{en:'Knotless Braids',fr:'Tresses Knotless'}, name:{en:'Boneless Knotless Braids (Silky Bone-Straight)',fr:'Tresses Knotless sans extensions rigides (lisses)'}, desc:{en:'',fr:''}, notes:NOTE_STD, options:[{label:null, duration:450, price:240}] },

  /* ---- Pick and Drop Braids ---- */
  { id:'pd1', cat:{en:'Pick and Drop Braids',fr:'Pick and Drop'}, name:{en:'Boho Pick & Drop Braids (Wavy/Curly Extension)',fr:'Pick & Drop Boho (extension ondulée/bouclée)'}, desc:{en:'',fr:''}, notes:NOTE_PICKDROP, options:[{label:null, duration:360, price:200}] },

  /* ---- Box Braids ---- */
  { id:'bx1', cat:{en:'Box Braids',fr:'Box Braids'}, name:{en:'Large Box Braids',fr:'Box Braids (Larges)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Bob',fr:'Bob'}, duration:180, price:100},
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:210, price:120},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:240, price:130},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:300, price:150},
    ]
  },
  { id:'bx2', cat:{en:'Box Braids',fr:'Box Braids'}, name:{en:'Medium Box Braids',fr:'Box Braids (Moyennes)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Bob',fr:'Bob'}, duration:210, price:120},
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:300, price:150},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:360, price:160},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:420, price:180},
    ]
  },
  { id:'bx3', cat:{en:'Box Braids',fr:'Box Braids'}, name:{en:'Small Box Braids',fr:'Box Braids (Petites)'}, desc:{en:'',fr:''}, notes:NOTE_STD,
    options:[
      {label:{en:'Shoulder length',fr:'Longueur épaule'}, duration:330, price:150},
      {label:{en:'Bra length',fr:'Longueur soutien-gorge'}, duration:360, price:170},
      {label:{en:'Waist length',fr:'Longueur taille'}, duration:390, price:190},
      {label:{en:'Butt length',fr:'Longueur fessier'}, duration:420, price:210},
    ]
  },

  /* ---- Weave Sew-In ---- */
  { id:'ws1', cat:{en:'Weave Sew-In',fr:'Tissage cousu (Sew-in)'}, name:{en:'Sew-In with Leave Out',fr:'Tissage cousu avec leave-out'}, desc:{en:'Cornrow base with weave installation.',fr:'Base en cornrows avec pose de tissage.'}, notes:NOTE_STD, options:[{label:null, duration:180, price:120}] },
  { id:'ws2', cat:{en:'Weave Sew-In',fr:'Tissage cousu (Sew-in)'}, name:{en:'Jayda Wada Hairstyle (Sew-In + Feed-In Cornrows)',fr:'Coiffure Jayda Wada (tissage + cornrows feed-in)'}, desc:{en:'',fr:''}, notes:NOTE_STD, options:[{label:null, duration:240, price:150}] },
  { id:'ws3', cat:{en:'Weave Sew-In',fr:'Tissage cousu (Sew-in)'}, name:{en:'Flip Over Sew-In',fr:'Tissage "Flip Over"'}, desc:{en:'',fr:''}, notes:NOTE_STD, options:[{label:null, duration:150, price:1350}] },
  { id:'ws4', cat:{en:'Weave Sew-In',fr:'Tissage cousu (Sew-in)'}, name:{en:'Weave with Closure',fr:'Tissage avec Closure'}, desc:{en:'',fr:''}, notes:NOTE_STD, options:[{label:null, duration:30, price:130}] },

  /* ---- Sleek Ponytail ---- */
  { id:'pt1', cat:{en:'Sleek Ponytail',fr:'Queue de cheval lisse'}, name:{en:'Ponytail (Top Bun or Low Bun)',fr:'Queue de cheval (chignon haut ou bas)'}, desc:{en:'',fr:''}, notes:NOTE_NOEXT, options:[{label:null, duration:120, price:100}] },
  { id:'pt2', cat:{en:'Sleek Ponytail',fr:'Queue de cheval lisse'}, name:{en:'Half-Up Half-Down Ponytail',fr:'Queue de cheval mi-haute mi-basse'}, desc:{en:'',fr:''}, notes:NOTE_NOEXT, options:[{label:null, duration:180, price:120}] },

  /* ---- Hair Wash and Relaxing ---- */
  { id:'hw1', cat:{en:'Hair Wash and Relaxing',fr:'Lavage et DÃ©frisage'}, name:{en:'Hair Shampoo',fr:'Shampoing'}, desc:{en:'This service includes wash & blow dry.',fr:'Ce service comprend le lavage et le brushing.'}, notes:{en:[],fr:[]}, options:[{label:null, duration:45, price:45}] },
  { id:'hw2', cat:{en:'Hair Wash and Relaxing',fr:'Lavage et DÃ©frisage'}, name:{en:'Relaxing Hair',fr:'DÃ©frisage'}, desc:{en:'With your own relaxing product.',fr:'Avec votre propre produit dÃ©frisant.'}, notes:{en:[],fr:[]}, options:[{label:null, duration:120, price:90}] },

  /* ---- Removing Hair ---- */
  { id:'rh1', cat:{en:'Removing Hair',fr:'Retrait de Coiffure'}, name:{en:'Weave Removal',fr:'Retrait de tissage'}, desc:{en:'',fr:''}, notes:{en:[],fr:[]}, options:[{label:null, duration:45, price:30}] },
  { id:'rh2', cat:{en:'Removing Hair',fr:'Retrait de Coiffure'}, name:{en:'Weave Removal + Hair Wash',fr:'Retrait de tissage + lavage'}, desc:{en:'This includes the blow dry.',fr:'Le brushing est inclus.'}, notes:{en:[],fr:[]}, options:[{label:null, duration:60, price:75}] },
  { id:'rh3', cat:{en:'Removing Hair',fr:'Retrait de Coiffure'}, name:{en:'Braids Removal + Hair Wash',fr:'Retrait de tresses + lavage'}, desc:{en:'',fr:''}, notes:{en:[],fr:[]}, options:[{label:null, duration:180, price:100}] },
  { id:'rh4', cat:{en:'Removing Hair',fr:'Retrait de Coiffure'}, name:{en:'Braids Removal',fr:'Retrait de tresses'}, desc:{en:'',fr:''}, notes:{en:[],fr:[]}, options:[{label:null, duration:120, price:70}] },

  /* ---- Faux Locs ---- */
  { id:'fl1', cat:{en:'Faux Locs',fr:'Faux Locs'}, name:{en:'Dread Locks Touch Up',fr:'Retouche de locks'}, desc:{en:'',fr:''}, notes:NOTE_NOEXT, options:[{label:null, duration:150, price:120}] },
];


function categories(lang){ return [...new Set(SERVICES.map(s => s.cat[lang]))]; }

function formatDuration(min, lang){
  const t = I18N[lang];
  if(min < 60) return `${min} ${t.minWord}`;
  const h = Math.floor(min/60), m = min%60;
  return m ? `${h} ${t.hrWord} ${m} ${t.minWord}` : `${h} ${t.hrWord}`;
}

/* ===================== BUSINESS HOURS / TIME SLOTS ===================== */
/* Booking window per day of week (Date#getDay(): 0=Sun..6=Sat), in 24h "HH:MM".
   Sunday is `null` — closed, no bookable slots at all that day. */
const BUSINESS_HOURS = {
  0: null,
  1: { open:'10:00', close:'18:00' },
  2: { open:'10:00', close:'18:00' },
  3: { open:'10:00', close:'18:00' },
  4: { open:'10:00', close:'18:00' },
  5: { open:'10:00', close:'18:00' },
  6: { open:'09:00', close:'20:00' },
};
function getBusinessHoursForDate(dateStr){
  if(!dateStr) return null;
  return BUSINESS_HOURS[new Date(dateStr + 'T00:00').getDay()];
}
function getTimeSlotsForDate(dateStr){
  const hours = getBusinessHoursForDate(dateStr);
  if(!hours) return [];
  const slots = [];
  let [h, m] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);
  while(h < closeH || (h === closeH && m <= closeM)){
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    m += 30;
    if(m >= 60){ m = 0; h += 1; }
  }
  return slots;
}
/* Slots are stored/compared as unambiguous 24h "HH:MM"; this is only for display. */
function formatSlotTime(hhmm, lang){
  if(typeof hhmm !== 'string') return '—';
  const [h, m] = hhmm.split(':').map(Number);
  if(Number.isNaN(h) || Number.isNaN(m)) return '—';
  if(lang === 'fr') return `${h}h${String(m).padStart(2,'0')}`;
  let h12 = h % 12; if(h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
}
/* Booking/blocked records come from Firestore and can be malformed (e.g. an old or
   hand-edited document missing `time`) — never throw on bad input, since one bad
   record would otherwise take down the whole day's rendering. */
function timeToMinutes(hhmm){
  if(typeof hhmm !== 'string') return NaN;
  const [h, m] = hhmm.split(':').map(Number);
  if(Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}
function slotToDate(dateStr, timeStr){
  return new Date(`${dateStr}T${timeStr}:00`);
}

/* ===================== TWO-WORKER SCHEDULING ===================== */
/* We have 2 workers, so up to 2 appointments can run at the same time — but each
   appointment occupies its worker for its FULL duration, not just its start slot. */
const WORKER_COUNT = 2;
async function getOccupiedByWorker(date){
  const [bookings, blocked] = await Promise.all([Bookings.all(), Blocked.all()]);
  const byWorker = {};
  for(let w = 1; w <= WORKER_COUNT; w++) byWorker[w] = [];
  const assign = (list, type) => {
    list.filter(b => b.date === date && b.status !== 'cancelled').forEach(b => {
      const start = timeToMinutes(b.time);
      if(Number.isNaN(start)) return; // malformed record (e.g. missing time) — skip it, don't crash the schedule
      const dur = b.duration || 30;
      const w = (b.worker >= 1 && b.worker <= WORKER_COUNT) ? b.worker : 1;
      byWorker[w].push({ start, end: start + dur, type, ref: b });
    });
  };
  assign(bookings, 'booking');
  assign(blocked, 'blocked');
  return byWorker;
}
/* Returns the first worker (1..N) with no overlap in [startMin,endMin), or 0 if none free. */
function findFreeWorker(byWorker, startMin, endMin){
  for(let w = 1; w <= WORKER_COUNT; w++){
    const busy = byWorker[w].some(iv => startMin < iv.end && endMin > iv.start);
    if(!busy) return w;
  }
  return 0;
}
function isPastSlot(dateStr, timeStr){
  return slotToDate(dateStr, timeStr).getTime() <= Date.now();
}

/* ===================== SHARED CHROME (header/footer/lang/quick actions) ===================== */
function initChrome(){
  const lang = getLang();

  // static text
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.getAttribute('data-i18n');
    if(typeof I18N[lang][key] === 'string') el.textContent = I18N[lang][key];
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{
    const key = el.getAttribute('data-i18n-html');
    if(I18N[lang][key] !== undefined) el.innerHTML = I18N[lang][key];
  });

  // nav + footer links keep the language param
  document.querySelectorAll('a[data-nav]').forEach(a=>{
    const base = a.getAttribute('data-nav');
    a.href = base.includes('#') ? base : withLang(base);
  });

  document.getElementById('langEn')?.classList.toggle('active', lang==='en');
  document.getElementById('langFr')?.classList.toggle('active', lang==='fr');
  document.getElementById('langEn')?.addEventListener('click', ()=>{ window.location.href = langUrl('en'); });
  document.getElementById('langFr')?.addEventListener('click', ()=>{ window.location.href = langUrl('fr'); });

  // contact links
  const wa = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_PRESET_MSG[lang])}`;
  document.getElementById('fabWhatsapp')?.setAttribute('href', wa);
  document.getElementById('whatsappBtnInline')?.setAttribute('href', wa);
  document.getElementById('fabCall')?.setAttribute('href', `tel:${PHONE_TEL}`);
  document.getElementById('callBtnInline')?.setAttribute('href', `tel:${PHONE_TEL}`);
  document.getElementById('fabInstagram')?.setAttribute('href', INSTAGRAM_URL);
  document.getElementById('fabTiktok')?.setAttribute('href', TIKTOK_URL);
  document.getElementById('fabFacebook')?.setAttribute('href', FACEBOOK_URL);

  // footer social row (desktop/tablet)
  document.getElementById('footerCall')?.setAttribute('href', `tel:${PHONE_TEL}`);
  document.getElementById('footerWhatsapp')?.setAttribute('href', wa);
  document.getElementById('footerInstagram')?.setAttribute('href', INSTAGRAM_URL);
  document.getElementById('footerTiktok')?.setAttribute('href', TIKTOK_URL);
  document.getElementById('footerFacebook')?.setAttribute('href', FACEBOOK_URL);

  // mobile nav toggle
  document.getElementById('navToggle')?.addEventListener('click', ()=>{
    document.getElementById('navLinks').classList.toggle('open');
  });

  // mobile quick-actions toggle (icons stay hidden until the button is tapped)
  const fabToggle = document.getElementById('fabToggle');
  const quickActions = document.getElementById('quickActions');
  fabToggle?.addEventListener('click', ()=>{
    const isOpen = quickActions.classList.toggle('open');
    fabToggle.classList.toggle('active', isOpen);
    fabToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  document.querySelectorAll('.nav-links a').forEach(a=>{
    a.addEventListener('click', ()=> document.getElementById('navLinks')?.classList.remove('open'));
  });

  // cart button: open the drawer if this page has one (services.html), otherwise go to it
  const cartBtn = document.getElementById('cartBtn');
  if(cartBtn){
    updateCartBadge();
    cartBtn.addEventListener('click', ()=>{
      if(typeof window.toggleCartDrawer === 'function'){
        window.toggleCartDrawer();
      } else {
        window.location.href = withLang('services.html') + '#book';
      }
    });
  }

  return lang;
}
