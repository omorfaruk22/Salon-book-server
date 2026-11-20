import "../config/env";
import { closeDatabase, connectDatabase } from "../config/database";
import { Service } from "../modules/services/service.model";

const image = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1200&q=85`;

const services = [
  { name: "Signature Haircut & Finish", slug: "signature-haircut-finish", category: "hair", description: "A tailored consultation, precision cut, restorative wash, and polished salon finish designed around your face shape and personal style.", durationMinutes: 45, price: 650, imageUrl: image("photo-1560066984-138dadb4c035") },
  { name: "Botanical Hair Spa Ritual", slug: "botanical-hair-spa-ritual", category: "hair", description: "A soothing scalp cleanse followed by a botanical conditioning mask and relaxing massage to bring softness and shine back to tired hair.", durationMinutes: 60, price: 1350, imageUrl: image("photo-1521590832167-7bcbfaa6381f") },
  { name: "Balayage & Gloss Refresh", slug: "balayage-gloss-refresh", category: "hair color", description: "Hand-painted dimension with a custom gloss to create naturally blended color, luminous depth, and a seamless grow-out.", durationMinutes: 180, price: 4800, imageUrl: image("photo-1562322140-8baeececf3df") },
  { name: "Silk Keratin Smoothing", slug: "silk-keratin-smoothing", category: "hair", description: "A professional smoothing treatment that helps tame frizz, improve manageability, and leave hair glossy with a soft, natural movement.", durationMinutes: 180, price: 5200, imageUrl: image("photo-1633681122703-3ce20f1e978d") },
  { name: "Precision Beard Sculpt", slug: "precision-beard-sculpt", category: "grooming", description: "A detail-led beard tidy with a personalized shape, clean edges, warm towel preparation, and nourishing finishing oil.", durationMinutes: 35, price: 550, imageUrl: image("photo-1503951914875-452162b0f3f1") },
  { name: "Royal Hot Towel Shave", slug: "royal-hot-towel-shave", category: "grooming", description: "A classic close shave with hot towels, rich lather, careful blade work, and a calming post-shave treatment for a refreshed finish.", durationMinutes: 45, price: 750, imageUrl: image("photo-1621605815971-fbc98d665033") },
  { name: "Hydra-Glow Facial", slug: "hydra-glow-facial", category: "facial", description: "A replenishing facial with gentle exfoliation, deep hydration, and a cooling mask to leave skin feeling comfortable and visibly refreshed.", durationMinutes: 60, price: 1650, imageUrl: image("photo-1570172619644-dfd03ed5d881") },
  { name: "Deep Pore Clarity Facial", slug: "deep-pore-clarity-facial", category: "facial", description: "A thorough yet calming cleanse with steam, careful extractions where suitable, and balancing care for a clearer-looking complexion.", durationMinutes: 70, price: 1850, imageUrl: image("photo-1515377905703-c4788e51af15") },
  { name: "Vitamin C Radiance Facial", slug: "vitamin-c-radiance-facial", category: "facial", description: "An antioxidant-focused facial with a brightening mask and relaxing face massage to help revive dull-looking skin and restore a fresh glow.", durationMinutes: 75, price: 2100, imageUrl: image("photo-1598440947619-2c35fc9aa908") },
  { name: "Signature Manicure", slug: "signature-manicure", category: "nails", description: "Nail shaping, cuticle care, a nourishing hand soak, gentle massage, and a flawless polish finish in your preferred salon shade.", durationMinutes: 45, price: 800, imageUrl: image("photo-1604654894610-df63bc536371") },
  { name: "Gloss Gel Manicure", slug: "gloss-gel-manicure", category: "nails", description: "A refined gel manicure with detailed nail preparation and a high-shine colour finish made for a durable, polished look.", durationMinutes: 60, price: 1350, imageUrl: image("photo-1610992015732-2449b76344bc") },
  { name: "Aromatic Spa Pedicure", slug: "aromatic-spa-pedicure", category: "nails", description: "A warm aromatic foot soak, exfoliation, careful nail care, hydrating mask, and relaxing massage for beautifully refreshed feet.", durationMinutes: 65, price: 1250, imageUrl: image("photo-1519014816548-bf5fe059798b") },
  { name: "Bridal Beauty Makeup", slug: "bridal-beauty-makeup", category: "makeup", description: "A personalized bridal makeup look with skin preparation, carefully layered detail, and a long-wear finish for your celebration.", durationMinutes: 150, price: 6500, imageUrl: image("photo-1487412720507-e7ab37603c6f") },
  { name: "Soft Glam Makeup", slug: "soft-glam-makeup", category: "makeup", description: "A polished soft-glam look with even complexion, softly defined eyes, and a custom lip colour for events and evenings out.", durationMinutes: 75, price: 2600, imageUrl: image("photo-1522337360788-8b13dee7a37e") },
  { name: "Calm Aromatherapy Massage", slug: "calm-aromatherapy-massage", category: "massage", description: "A restorative full-body massage using aromatic oils and measured pressure to ease everyday tension and encourage deep relaxation.", durationMinutes: 75, price: 2900, imageUrl: image("photo-1540555700478-4be289fbecef") },
  { name: "Luxe Scalp Reset", slug: "luxe-scalp-reset", category: "hair", description: "A clarifying scalp cleanse, warm botanical compress, and slow-pressure massage followed by a weightless conditioning finish for a refreshed, salon-ready feel.", durationMinutes: 50, price: 1400, imageUrl: image("photo-1599351431202-1e0f0137899a") },
  { name: "Silk Press & Signature Blowout", slug: "silk-press-signature-blowout", category: "hair styling", description: "A smooth, high-shine styling service with a careful heat-protective prep, polished shape, and long-lasting movement tailored to your desired finish.", durationMinutes: 75, price: 1800, imageUrl: image("photo-1595475884562-073c30d45670") },
  { name: "Root Melt & Toner", slug: "root-melt-toner", category: "hair coloring", description: "A seamless root blend and custom toner that softens regrowth, refines your shade, and adds dimensional shine between full colour appointments.", durationMinutes: 120, price: 3600, imageUrl: image("photo-1527799820374-dcf8d9d4a388") },
  { name: "Defined Curl Shape & Diffuse", slug: "defined-curl-shape-diffuse", category: "hair styling", description: "A curl-focused consultation, shape refresh, hydration layer, and diffuser finish that brings out natural definition while keeping curls soft and touchable.", durationMinutes: 75, price: 1900, imageUrl: image("photo-1605497788044-5a32c7078486") },
  { name: "Brow Sculpt & Tint", slug: "brow-sculpt-tint", category: "grooming", description: "A face-framing brow consultation with precise shaping and a softly blended tint for a neat, balanced look that suits your features.", durationMinutes: 35, price: 850, imageUrl: image("photo-1534528741775-53994a69daeb") },
  { name: "Lash Lift & Tint", slug: "lash-lift-tint", category: "makeup", description: "A lash lift and custom tint designed to add a defined, lifted finish to your natural lashes, followed by a conditioning aftercare step.", durationMinutes: 60, price: 2100, imageUrl: image("photo-1596462502278-27bfdc403348") },
  { name: "Hydra-Infusion Peel", slug: "hydra-infusion-peel", category: "skin care", description: "A gentle resurfacing facial paired with a hydrating serum infusion and cooling mask to leave skin feeling smooth, comfortable, and freshly replenished.", durationMinutes: 65, price: 2400, imageUrl: image("photo-1616394584738-fc6e612e71b9") },
  { name: "Rose Quartz Body Polish", slug: "rose-quartz-body-polish", category: "spa", description: "A slow, aromatic body polish with a warm rinse and rich moisturising finish for a relaxed, silky-smooth salon spa experience.", durationMinutes: 75, price: 2800, imageUrl: image("photo-1600334129128-685c5582fd35") },
  { name: "Builder Gel Extensions", slug: "builder-gel-extensions", category: "nails", description: "A structured builder-gel set with tailored length, careful shaping, cuticle detailing, and a glossy colour finish for a refined, durable look.", durationMinutes: 100, price: 2500, imageUrl: image("photo-1632345031435-8727f6897d53") },
  { name: "Custom Nail Art Atelier", slug: "custom-nail-art-atelier", category: "nails", description: "A detailed nail-art appointment with a curated design consultation, fine-line accents, and a protective top coat over your chosen base colour.", durationMinutes: 50, price: 1100, imageUrl: image("photo-1641814250010-9887d86eedfd") },
] as const;

async function seedServices() {
  await connectDatabase();
  try {
    const result = await Service.bulkWrite(
      services.map((service) => ({
        updateOne: {
          filter: { slug: service.slug },
          update: { $setOnInsert: { ...service, isActive: true } },
          upsert: true,
        },
      })),
      { ordered: true },
    );
    console.info(`Service catalog seed complete: ${result.upsertedCount} added, ${services.length - result.upsertedCount} already existed. Existing records were left unchanged.`);
  } finally {
    await closeDatabase();
  }
}

void seedServices().catch((error: unknown) => {
  console.error("Could not seed SalonBook services.", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
