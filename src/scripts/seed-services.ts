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
