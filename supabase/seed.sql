-- La Villa — seed data, ported verbatim from the prototype (data.jsx, store.jsx).
-- Idempotent: safe to re-run.

-- ── Categories ───────────────────────────────────────────────────────────────
insert into categories (key, label, universe, sort) values
  ('gateaux',       'Gâteaux',          'patisserie', 1),
  ('viennoiseries', 'Viennoiseries',    'patisserie', 2),
  ('tartes',        'Tartes',           'patisserie', 3),
  ('sales',         'Salés',            'restaurant', 4),
  ('formules',      'Formules',         'restaurant', 5),
  ('boissons',      'Boissons',         'restaurant', 6),
  ('ramadan',       'Spécial Ramadan',  'patisserie', 7)
on conflict (key) do nothing;

-- ── Products ─────────────────────────────────────────────────────────────────
insert into products
  (slug, name, universe, category, price_dh, rating, reviews_count, photo_label,
   description, is_customizable, diet_badges, tags, is_signature)
values
  ('p-fraisier', 'Le Fraisier de La Villa', 'patisserie', 'gateaux', 165, 4.9, 214, 'Fraisier entier',
   'Génoise vanille de Madagascar, crème mousseline légère et fraises fraîches de Sefrou. Notre signature depuis 2007.',
   true, '{Fait maison}', '{Chef,"Fait maison"}', true),
  ('p-royal', 'Royal Chocolat', 'patisserie', 'gateaux', 145, 4.8, 188, 'Royal chocolat',
   'Dacquoise noisette, croustillant praliné et mousse au chocolat noir 70 %. Intense et fondant.',
   true, '{Fait maison}', '{Populaire,"Fait maison"}', true),
  ('p-cheesecake', 'Cheesecake Spéculoos', 'patisserie', 'gateaux', 120, 4.7, 96, 'Cheesecake spéculoos',
   'Base spéculoos croquante, appareil onctueux au fromage frais et coulis de fruits rouges.',
   true, '{}', '{Nouveau}', false),
  ('p-croissant', 'Croissant pur beurre', 'patisserie', 'viennoiseries', 9, 4.9, 412, 'Croissant doré',
   'Feuilletage 100 % beurre, levé sur 48 h. Croustillant dehors, moelleux dedans.',
   false, '{"Fait maison"}', '{"Fait maison"}', false),
  ('p-painchoc', 'Pain au chocolat', 'patisserie', 'viennoiseries', 11, 4.8, 305, 'Pain au chocolat',
   'Deux barres de chocolat noir enrobées d''un feuilletage généreux.',
   false, '{}', '{Populaire}', false),
  ('p-tartecitron', 'Tarte au citron meringuée', 'patisserie', 'tartes', 95, 4.8, 142, 'Tarte citron meringuée',
   'Pâte sablée, crème de citron de Beni Mellal et meringue italienne dorée au chalumeau.',
   true, '{Végétarien}', '{Chef,Végétarien}', true),
  ('p-tartepommes', 'Tarte fine aux pommes', 'patisserie', 'tartes', 85, 4.6, 78, 'Tarte fine aux pommes',
   'Pommes fondantes en rosace sur une fine couche de compote, nappage abricot.',
   false, '{"Sans gluten"}', '{"Sans gluten"}', false),
  ('p-macarons', 'Coffret 12 macarons', 'patisserie', 'gateaux', 130, 4.9, 256, 'Coffret de macarons',
   'Assortiment de douze macarons : pistache, framboise, caramel beurre salé, vanille, café, chocolat.',
   false, '{}', '{Chef,"Édition limitée"}', true),
  ('r-tajine', 'Tajine de poulet aux olives', 'restaurant', 'sales', 78, 4.8, 167, 'Tajine poulet citron',
   'Poulet fermier mijoté au citron confit, olives violettes et coriandre fraîche. Servi avec pain maison.',
   false, '{Halal}', '{Halal,Populaire}', false),
  ('r-pastilla', 'Pastilla au poulet', 'restaurant', 'sales', 92, 4.9, 203, 'Pastilla saupoudrée',
   'Feuilles de brick croustillantes, poulet aux amandes et cannelle, voile de sucre glace.',
   false, '{Halal}', '{Chef,Halal}', true),
  ('r-couscous', 'Couscous du vendredi', 'restaurant', 'sales', 110, 4.7, 134, 'Couscous sept légumes',
   'Semoule roulée à la main, sept légumes de saison, viande tendre et bouillon parfumé.',
   false, '{Halal}', '{Halal}', false),
  ('r-salade', 'Salade La Villa', 'restaurant', 'sales', 55, 4.5, 61, 'Salade composée',
   'Jeunes pousses, avocat, grenade, fromage frais et vinaigrette à l''huile d''argan.',
   false, '{Végétarien,"Sans gluten"}', '{Végétarien,"Sans gluten"}', false),
  ('r-formuledej', 'Formule Déjeuner', 'restaurant', 'formules', 130, 4.7, 98, 'Formule entrée-plat-dessert',
   'Entrée + plat du jour + dessert pâtissier + boisson. La maison dans une seule formule.',
   false, '{}', '{Chef}', true),
  ('r-formulebrunch', 'Brunch de La Villa', 'restaurant', 'formules', 165, 4.8, 112, 'Plateau brunch garni',
   'Viennoiseries, œufs, msemen, jus pressé, boisson chaude et assortiment sucré-salé.',
   false, '{}', '{Chef,Week-end}', true),
  ('r-the', 'Thé à la menthe', 'restaurant', 'boissons', 22, 4.9, 320, 'Thé à la menthe versé',
   'Thé vert Gunpowder, menthe nanah fraîche, versé en hauteur. Le rituel marocain.',
   false, '{Halal}', '{Halal}', false),
  ('r-jus', 'Jus d''orange pressé', 'restaurant', 'boissons', 28, 4.7, 145, 'Jus d''orange frais',
   'Oranges de Berkane pressées minute. Rien d''autre.',
   false, '{"Sans gluten",Végétarien}', '{"Sans gluten",Végétarien}', false),
  ('rm-chebakia', 'Chebakia (500 g)', 'patisserie', 'ramadan', 60, 4.9, 188, 'Chebakia au miel',
   'Pâte au sésame et anis, frite et enrobée de miel pur. Indispensable du Ftour.',
   false, '{"Fait maison"}', '{Ramadan,"Fait maison"}', true),
  ('rm-harira', 'Harira maison (1 L)', 'restaurant', 'ramadan', 45, 4.8, 156, 'Bol de harira',
   'Soupe traditionnelle tomate, lentilles, pois chiches et herbes. Réconfortante.',
   false, '{Halal}', '{Ramadan,Halal}', false),
  ('rm-ftour', 'Plateau Ftour Famille', 'patisserie', 'ramadan', 220, 4.9, 74, 'Plateau Ftour complet',
   'Harira, chebakia, sellou, dattes, msemen, jus et pâtisseries. Pour 4 à 6 personnes.',
   false, '{}', '{Ramadan,Chef,"Édition limitée"}', true)
on conflict (slug) do nothing;

-- ── Delivery zones (Fès) ─────────────────────────────────────────────────────
insert into delivery_zones (name, fee_dh, eta_min, eta_max) values
  ('Médina (Fès el-Bali)', 15, 30, 40),
  ('Ville Nouvelle',       12, 22, 30),
  ('Route d''Imouzzer',    20, 38, 48),
  ('Saïss',                18, 34, 44)
on conflict do nothing;

-- ── Drivers ──────────────────────────────────────────────────────────────────
insert into drivers (name, vehicle, rating, phone) values
  ('Karim',   'Scooter', 4.9, '+212 6 12 34 56 78'),
  ('Youssef', 'Scooter', 4.8, '+212 6 87 65 43 21')
on conflict do nothing;

-- ── Rewards (points exchange) ────────────────────────────────────────────────
insert into rewards (title, cost_pts) values
  ('Café ou thé offert', 150),
  ('Livraison offerte ×3', 300),
  ('Pâtisserie au choix', 400),
  ('-50 DH sur une formule', 600),
  ('Coffret 12 macarons', 900),
  ('Création du chef', 1200)
on conflict do nothing;
