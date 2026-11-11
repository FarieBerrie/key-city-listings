import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { demoAccounts } from "../lib/config";

// The seed deletes every row before loading sample data, so it only runs against a database on
// this machine. Set ALLOW_REMOTE_SEED=true to seed somewhere else (a throwaway staging database).
const databaseHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(databaseHost) && process.env.ALLOW_REMOTE_SEED !== "true") {
  console.error(
    `Refusing to seed: DATABASE_URL points at "${databaseHost || "an unknown host"}", not this machine. ` +
      "Seeding deletes all data. Set ALLOW_REMOTE_SEED=true if that's really what you want.",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function main() {
  await prisma.passwordResetToken.deleteMany();
  await prisma.rateLimit.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.jobRequest.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.contractorTrade.deleteMany();
  await prisma.serviceArea.deleteMany();
  await prisma.contractorProfile.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(demoAccounts.password, 10);

  const contractors = [
    {
      name: "Mara Ellison",
      email: demoAccounts.contractor.email,
      businessName: "Red River Electric",
      phone: "(325) 555-0142",
      website: "https://redriverelectric.example",
      city: "Abilene",
      tier: "FEATURED",
      trades: ["electrical"],
      areas: [
        ["Abilene", "city"],
        ["Tye", "city"],
        ["79601", "zip"],
        ["79603", "zip"],
        ["79605", "zip"],
      ],
      description:
        "Licensed electricians for Abilene storefronts, cafes, and small offices. Panel upgrades, lighting, and the circuit that trips every time the grinder and the fridge run together.",
      licenseNotes: "Texas electrical contractor, sample license TECL-441902.",
      insuranceNotes: "General liability $1M per occurrence. Certificate sent on request.",
    },
    {
      name: "Luis Ortega",
      email: "luis@catclawplumbing.example",
      businessName: "Catclaw Plumbing Co.",
      phone: "(325) 555-0194",
      website: "",
      city: "Abilene",
      tier: "BASIC",
      trades: ["plumbing"],
      areas: [
        ["Abilene", "city"],
        ["Merkel", "city"],
        ["79601", "zip"],
        ["79605", "zip"],
        ["79536", "zip"],
      ],
      description:
        "Drain cleaning, water heaters, and fixture repairs for shops along Catclaw and the north side, plus a regular run out to Merkel.",
      licenseNotes: "Texas plumbing license, sample M-38221.",
      insuranceNotes: "Liability and workers comp on file. Happy to send a certificate before the job.",
    },
    {
      name: "Denise Harper",
      email: "denise@buffalogapair.example",
      businessName: "Buffalo Gap Air",
      phone: "(325) 555-0177",
      website: "https://buffalogapair.example",
      city: "Buffalo Gap",
      tier: "FEATURED",
      trades: ["hvac"],
      areas: [
        ["Abilene", "city"],
        ["Buffalo Gap", "city"],
        ["Tuscola", "city"],
        ["79602", "zip"],
        ["79606", "zip"],
        ["79508", "zip"],
      ],
      description:
        "Rooftop units, walk-in coolers, and seasonal service for clinics and restaurants from Buffalo Gap up to the mall corridor.",
      licenseNotes: "TACLA sample license A-22910. EPA 608 universal.",
      insuranceNotes: "General liability $2M aggregate. Additional insured available.",
    },
    {
      name: "Grant Pelham",
      email: "grant@mesastoneroofing.example",
      businessName: "Mesa Stone Roofing",
      phone: "(325) 555-0118",
      website: "",
      city: "Abilene",
      tier: "BASIC",
      trades: ["roofing"],
      areas: [
        ["Abilene", "city"],
        ["Potosi", "city"],
        ["79601", "zip"],
        ["79606", "zip"],
      ],
      description:
        "Coatings, leak chases, and reroofs for low-slope commercial buildings. We photograph the deck before we cover it back up.",
      licenseNotes: "Local roofing registration on file with the City of Abilene, sample.",
      insuranceNotes: "Liability coverage for roofing operations. Certificate on request.",
    },
    {
      name: "Asha Nguyen",
      email: "asha@lytlecreekpainters.example",
      businessName: "Lytle Creek Painters",
      phone: "(325) 555-0160",
      website: "",
      city: "Abilene",
      tier: "BASIC",
      trades: ["painting"],
      areas: [
        ["Abilene", "city"],
        ["Clyde", "city"],
        ["79603", "zip"],
        ["79510", "zip"],
      ],
      description:
        "Interior and exterior painting for retail and offices. We can work evenings and Sundays when you need the doors open Monday.",
      licenseNotes: "No state painting license required. City of Abilene vendor packet available.",
      insuranceNotes: "General liability $1M. We mask floors and keep a daily cleanup.",
    },
    {
      name: "Caleb Ward",
      email: "caleb@prairielinelandscaping.example",
      businessName: "Prairie Line Landscaping",
      phone: "(325) 555-0133",
      website: "https://prairieline.example",
      city: "Abilene",
      tier: "FEATURED",
      trades: ["landscaping"],
      areas: [
        ["Abilene", "city"],
        ["Impact", "city"],
        ["Hawley", "city"],
        ["79605", "zip"],
        ["79606", "zip"],
        ["79525", "zip"],
      ],
      description:
        "Irrigation repair, seasonal color, and cleanup for storefronts and small office parks. We know what survives a Big Country July.",
      licenseNotes: "Irrigator sample license LI00-4412. TDA applicator on the crew.",
      insuranceNotes: "Liability and auto coverage for trailers and mowers.",
    },
    {
      name: "June Callahan",
      email: "june@saylesbuilders.example",
      businessName: "Sayles General Builders",
      phone: "(325) 555-0188",
      website: "",
      city: "Abilene",
      tier: "BASIC",
      trades: ["general"],
      areas: [
        ["Abilene", "city"],
        ["79601", "zip"],
        ["79602", "zip"],
        ["79603", "zip"],
      ],
      description:
        "Tenant improvements, doors, flooring, and the odd punch-out list for local landlords. Small crews, one job at a time.",
      licenseNotes: "Sample residential and commercial builder registration R-11820.",
      insuranceNotes: "General liability and builders risk discussed per project.",
    },
    {
      name: "Pete Navarro",
      email: "pete@cedarridgeelectric.example",
      businessName: "Cedar Ridge Electric",
      phone: "(325) 555-0126",
      website: "",
      city: "Tuscola",
      tier: "BASIC",
      trades: ["electrical"],
      areas: [
        ["Abilene", "city"],
        ["Tuscola", "city"],
        ["79602", "zip"],
        ["79606", "zip"],
        ["79562", "zip"],
      ],
      description:
        "Service work south of S. 14th and out toward Tuscola. Lighting retrofits and dedicated circuits for shops that added equipment.",
      licenseNotes: "Texas electrical contractor, sample TECL-550318.",
      insuranceNotes: "General liability $1M. We pull permits when the city requires them.",
    },
  ] as const;

  const contractorUsers = [];
  for (const contractor of contractors) {
    const user = await prisma.user.create({
      data: {
        name: contractor.name,
        email: contractor.email,
        passwordHash,

        emailVerifiedAt: new Date(),
        role: "CONTRACTOR",
        contractorProfile: {
          create: {
            businessName: contractor.businessName,
            description: contractor.description,
            phone: contractor.phone,
            contactEmail: contractor.email,
            website: contractor.website,
            licenseNotes: contractor.licenseNotes,
            insuranceNotes: contractor.insuranceNotes,
            city: contractor.city,
            trades: { create: contractor.trades.map((trade) => ({ trade })) },
            areas: {
              create: contractor.areas.map(([label, kind]) => ({ label, kind })),
            },
            listing: {
              create: {
                tier: contractor.tier,
                status: "ACTIVE",
                currentPeriodEnd: daysFromNow(32),
                activatedAt: hoursAgo(24 * 20),
              },
            },
          },
        },
      },
    });
    contractorUsers.push(user);
  }

  const nora = await prisma.user.create({
    data: {
      name: "Nora Blake",
      email: demoAccounts.customer.email,
      passwordHash,

      emailVerifiedAt: new Date(),
      role: "CUSTOMER",
      customerProfile: {
        create: {
          businessName: "Elm & Pine Cafe",
          description: "Breakfast and lunch spot on Cypress, open six days a week.",
          phone: "(325) 555-0104",
          city: "Abilene",
        },
      },
    },
  });

  const elliot = await prisma.user.create({
    data: {
      name: "Elliot Marsh",
      email: "elliot@saylesbooks.example",
      passwordHash,

      emailVerifiedAt: new Date(),
      role: "CUSTOMER",
      customerProfile: {
        create: {
          businessName: "Sayles Street Books",
          description: "Used books and a small events room.",
          phone: "(325) 555-0155",
          city: "Abilene",
        },
      },
    },
  });

  const priya = await prisma.user.create({
    data: {
      name: "Priya Shah",
      email: "priya@cedarcreekdental.example",
      passwordHash,

      emailVerifiedAt: new Date(),
      role: "CUSTOMER",
      customerProfile: {
        create: {
          businessName: "Cedar Creek Dental",
          description: "Four-operatory practice on the south side.",
          phone: "(325) 555-0170",
          city: "Abilene",
        },
      },
    },
  });

  const hank = await prisma.user.create({
    data: {
      name: "Hank Ruiz",
      email: "hank@mockingbirdstorage.example",
      passwordHash,

      emailVerifiedAt: new Date(),
      role: "CUSTOMER",
      customerProfile: {
        create: {
          businessName: "Mockingbird Mini Storage",
          description: "Drive-up units and a small office on the Merkel highway.",
          phone: "(325) 555-0190",
          city: "Merkel",
        },
      },
    },
  });

  const panelJob = await prisma.jobRequest.create({
    data: {
      customerId: nora.id,
      title: "Dedicated circuit for the back office",
      description:
        "The breaker trips when the espresso grinder and the mini fridge run together. We need someone to look at the back office and quote a dedicated circuit before the holiday rush. Access is from the alley after 2 p.m.",
      trade: "electrical",
      city: "Abilene",
      zip: "79601",
      budgetMin: 1800,
      budgetMax: 3200,
      timeline: "Before the holiday rush",
      createdAt: hoursAgo(30),
    },
  });

  const hvacJob = await prisma.jobRequest.create({
    data: {
      customerId: priya.id,
      title: "Spring service for the operatory wing",
      description:
        "Two split systems serve the operatories. Filters are awkward to reach and one room runs warm by mid-afternoon. We want a checkup, filter swap, and a note on anything that should be replaced this year.",
      trade: "hvac",
      city: "Abilene",
      zip: "79605",
      budgetMin: 400,
      budgetMax: 900,
      timeline: "Within 3 weeks",
      createdAt: hoursAgo(50),
    },
  });

  await prisma.jobRequest.create({
    data: {
      customerId: elliot.id,
      title: "Repaint the storefront trim",
      description:
        "The alley door and the storefront trim are peeling. Interior can wait. We need a color match to the existing green and the work done while the shop is closed on Mondays.",
      trade: "painting",
      city: "Abilene",
      zip: "79601",
      budgetMin: 1200,
      budgetMax: 2500,
      timeline: "This month",
      createdAt: hoursAgo(18),
    },
  });

  const plumbingJob = await prisma.jobRequest.create({
    data: {
      customerId: hank.id,
      title: "Two leaking hose bibs and a slow drain",
      description:
        "The hose bibs on the west side of the storage office drip, and the customer restroom drain is slow. Gate code will be shared the morning of the visit. Please do not block the drive aisle.",
      trade: "plumbing",
      city: "Merkel",
      zip: "79536",
      budgetMin: 250,
      budgetMax: 700,
      timeline: "As soon as you can",
      createdAt: hoursAgo(12),
    },
  });

  await prisma.jobRequest.create({
    data: {
      customerId: nora.id,
      title: "Patch the cafe roof before storm season",
      description:
        "We had a damp ceiling tile after the last hard rain, near the back office. Looking for a leak chase and a coating quote if the membrane is tired. The roof is low-slope and accessed by an interior ladder.",
      trade: "roofing",
      city: "Abilene",
      zip: "79601",
      budgetMin: 3500,
      budgetMax: 7000,
      timeline: "Next 6 weeks",
      createdAt: hoursAgo(8),
    },
  });

  await prisma.jobRequest.create({
    data: {
      customerId: elliot.id,
      title: "Repair a side gate and a sticking door",
      description:
        "The alley gate sags and will not latch, and the office door sticks at the top. Nothing structural that we know of. We can close the shop for a weekday morning.",
      trade: "general",
      city: "Abilene",
      zip: "79601",
      budgetMin: 400,
      budgetMax: 900,
      timeline: "Next two weeks",
      createdAt: hoursAgo(6),
    },
  });

  const mara = contractorUsers[0];
  const luis = contractorUsers[1];
  const denise = contractorUsers[2];

  const plumbingThread = await prisma.conversation.create({
    data: {
      contractorId: luis.id,
      customerId: hank.id,
      jobRequestId: plumbingJob.id,
      createdAt: hoursAgo(10),
      updatedAt: hoursAgo(2),
    },
  });
  await prisma.message.createMany({
    data: [
      {
        conversationId: plumbingThread.id,
        senderId: hank.id,
        body: "The hose bibs are on the west side of the storage office. The slow drain is in the restroom customers use.",
        createdAt: hoursAgo(10),
        readAt: hoursAgo(9),
      },
      {
        conversationId: plumbingThread.id,
        senderId: luis.id,
        body: "I can be there Thursday morning. Are the bibs frost-free or the older sillcock style?",
        createdAt: hoursAgo(5),
        readAt: hoursAgo(4),
      },
      {
        conversationId: plumbingThread.id,
        senderId: hank.id,
        body: "Older sillcocks. I will share the gate code when you roll up so it is not sitting in this thread.",
        createdAt: hoursAgo(2),
        readAt: null,
      },
    ],
  });

  const hvacThread = await prisma.conversation.create({
    data: {
      contractorId: denise.id,
      customerId: priya.id,
      jobRequestId: hvacJob.id,
      createdAt: hoursAgo(40),
      updatedAt: hoursAgo(3),
    },
  });
  await prisma.message.createMany({
    data: [
      {
        conversationId: hvacThread.id,
        senderId: priya.id,
        body: "We need the operatory wing checked before summer. Two split systems, and the filters are a pain to reach.",
        createdAt: hoursAgo(40),
        readAt: hoursAgo(36),
      },
      {
        conversationId: hvacThread.id,
        senderId: denise.id,
        body: "I can walk it Tuesday after 2. I will bring filters if you want them swapped the same visit.",
        createdAt: hoursAgo(3),
        readAt: null,
      },
    ],
  });

  const electricThread = await prisma.conversation.create({
    data: {
      contractorId: mara.id,
      customerId: nora.id,
      jobRequestId: panelJob.id,
      createdAt: hoursAgo(20),
      updatedAt: hoursAgo(16),
    },
  });
  await prisma.message.createMany({
    data: [
      {
        conversationId: electricThread.id,
        senderId: nora.id,
        body: "The back office breaker trips when the espresso grinder and the mini fridge run together.",
        createdAt: hoursAgo(20),
        readAt: hoursAgo(19),
      },
      {
        conversationId: electricThread.id,
        senderId: mara.id,
        body: "That sounds like a shared circuit with the bar. I can look Thursday and quote a dedicated circuit.",
        createdAt: hoursAgo(16),
        readAt: hoursAgo(15),
      },
    ],
  });

  console.log(`Seeded ${siteSafeCount(contractorUsers.length)} contractors and 4 businesses.`);
  console.log(`Demo password for every sample account: ${demoAccounts.password}`);
}

function siteSafeCount(count: number) {
  return count;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
