const guides = [
  {
    slug: "healthy-crop-observation",
    category: "prevention",
    title_en: "Start with careful crop observation",
    title_sw: "Anza kwa kuchunguza mimea kwa makini",
    summary_en: "Record what changed before choosing a response.",
    summary_sw: "Andika mabadiliko uliyoyaona kabla ya kuchagua hatua.",
    body_en: "Check several affected and healthy plants. Note the crop, plant part, first date noticed, how quickly the symptoms appear to spread, recent rainfall or watering, and any recent field activity. Take clear photos from the same distance at follow-up checks. Similar symptoms can have different causes, so observations help a local agricultural professional assess the problem.",
    body_sw: "Kagua mimea kadhaa iliyoathirika na iliyo na afya. Andika aina ya zao, sehemu ya mmea, tarehe ulipoona dalili kwa mara ya kwanza, kasi ya kuenea kwa dalili, mvua au umwagiliaji wa hivi karibuni, na shughuli zozote za shamba. Piga picha wazi kutoka umbali uleule unapofuatilia. Dalili zinazofanana zinaweza kusababishwa na mambo tofauti, hivyo uchunguzi humsaidia mtaalamu wa kilimo wa eneo lako kutathmini tatizo.",
  },
  {
    slug: "crop-rotation-basics",
    category: "crop",
    title_en: "Crop rotation basics",
    title_sw: "Misingi ya kubadilisha mazao",
    summary_en: "Plan different crop families across seasons where practical.",
    summary_sw: "Panga kupanda familia tofauti za mazao kwa misimu inapowezekana.",
    body_en: "Where practical, avoid growing the same crop family in the same plot season after season. Rotating crops can support soil health and interrupt some crop-specific pest and disease cycles. Keep a simple field record of what was planted and when. Choose crops suited to local rainfall, soil and available advice; rotation alone does not guarantee pest control.",
    body_sw: "Inapowezekana, epuka kupanda familia ileile ya zao kwenye shamba moja kila msimu. Kubadilisha mazao kunaweza kusaidia afya ya udongo na kuvunja mizunguko ya baadhi ya wadudu na magonjwa maalumu ya mimea. Weka rekodi rahisi ya mazao yaliyopandwa na tarehe. Chagua mazao yanayofaa mvua, udongo na ushauri unaopatikana eneo lako; kubadilisha mazao pekee hakuhakikishi kudhibiti wadudu.",
  },
  {
    slug: "soil-cover-and-mulch",
    category: "soil",
    title_en: "Protect soil with plant cover",
    title_sw: "Linda udongo kwa kuufunika",
    summary_en: "Mulch and suitable plant cover can help conserve soil moisture.",
    summary_sw: "Matandazo na mimea inayofaa vinaweza kusaidia kuhifadhi unyevu wa udongo.",
    body_en: "When suitable for the crop, clean plant residue or other locally recommended mulch can reduce direct sun and raindrop impact on soil. Keep mulch from touching crop stems where this could encourage rot or shelter pests. Use healthy, appropriate material and follow local guidance, especially where crop disease is present.",
    body_sw: "Inapofaa kwa zao, mabaki safi ya mimea au matandazo yanayopendekezwa eneo lako yanaweza kupunguza jua kali na athari za matone ya mvua kwenye udongo. Weka matandazo mbali na mashina ya zao pale yanapoweza kusababisha kuoza au kuficha wadudu. Tumia nyenzo safi na inayofaa, na fuata ushauri wa eneo lako hasa kunapokuwa na ugonjwa wa mimea.",
  },
  {
    slug: "safe-pest-monitoring",
    category: "pest",
    title_en: "Monitor crops for pests safely",
    title_sw: "Fuatilia wadudu wa mimea kwa usalama",
    summary_en: "Inspect plants regularly and identify a pest before considering control.",
    summary_sw: "Kagua mimea mara kwa mara na tambua mdudu kabla ya kufikiria udhibiti.",
    body_en: "Inspect leaves, stems and growing points regularly, including the underside of leaves. Record the number of plants affected and whether damage is increasing. Encourage helpful insects and maintain field hygiene where appropriate. Do not mix or apply pesticides based only on an uncertain identification; ask a qualified local agricultural professional for crop-specific guidance.",
    body_sw: "Kagua majani, mashina na ncha za ukuaji mara kwa mara, pamoja na upande wa chini wa majani. Andika idadi ya mimea iliyoathirika na kama uharibifu unaongezeka. Linda wadudu wenye manufaa na dumisha usafi wa shamba inapofaa. Usichanganye wala kutumia viuatilifu kwa kutegemea utambuzi usio na uhakika; omba ushauri wa zao husika kutoka kwa mtaalamu wa kilimo wa eneo lako.",
  },
  {
    slug: "livestock-daily-checks",
    category: "livestock",
    title_en: "Simple daily livestock checks",
    title_sw: "Ukaguzi rahisi wa mifugo wa kila siku",
    summary_en: "Watch appetite, water intake, movement and changes in behaviour.",
    summary_sw: "Angalia hamu ya kula, unywaji wa maji, mwendo na mabadiliko ya tabia.",
    body_en: "Observe animals calmly each day. Note appetite, water intake, movement, breathing, manure and any unusual behaviour or visible injury. Keep housing clean, provide clean water and follow locally recommended vaccination and parasite-control schedules. Separate a sick animal when safe and practical, and contact a veterinary professional promptly for severe or rapidly worsening signs. Do not give human medicines or guess a dose.",
    body_sw: "Chunguza mifugo kwa utulivu kila siku. Andika hamu ya kula, unywaji wa maji, mwendo, upumuaji, kinyesi na tabia isiyo ya kawaida au jeraha linaloonekana. Weka banda safi, toa maji safi na fuata ratiba za chanjo na udhibiti wa vimelea zinazopendekezwa eneo lako. Mtenganishe mnyama mgonjwa inapowezekana kwa usalama, na wasiliana na mtaalamu wa mifugo haraka dalili zikiwa kali au zinazidi haraka. Usimpe mnyama dawa za binadamu wala kubahatisha dozi.",
  },
];

exports.up = async function (knex) {
  await knex.schema.alterTable("users", (table) => {
    table.boolean("is_active").notNullable().defaultTo(true);
    table.integer("auth_version").notNullable().defaultTo(0);
  });

  await knex.schema.createTable("password_reset_tokens", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.text("token_hash").notNullable().unique();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("used_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["user_id", "expires_at"], "password_reset_tokens_user_expiry_idx");
  });

  await knex.schema.createTable("knowledge_guides", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.text("slug").notNullable().unique("knowledge_guides_slug_uq");
    table.text("category").notNullable();
    table.text("title_en").notNullable();
    table.text("title_sw").notNullable();
    table.text("summary_en").notNullable();
    table.text("summary_sw").notNullable();
    table.text("body_en").notNullable();
    table.text("body_sw").notNullable();
    table.boolean("is_published").notNullable().defaultTo(true);
    table.uuid("created_by").nullable().references("id").inTable("users").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["category", "updated_at"], "knowledge_guides_category_updated_idx");
  });

  await knex("knowledge_guides").insert(guides);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("knowledge_guides");
  await knex.schema.dropTableIfExists("password_reset_tokens");
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("auth_version");
    table.dropColumn("is_active");
  });
};
