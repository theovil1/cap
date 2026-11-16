-- The app is called Tapiroute in the stores; Cap stays its code name.
UPDATE users SET first_name = 'Équipe Tapiroute'
WHERE id = '00000000-0000-0000-0000-000000000ca9';
UPDATE users SET username = 'tapiroute'
WHERE id = '00000000-0000-0000-0000-000000000ca9'
  AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'tapiroute');
UPDATE public_routes SET description = replace(description, 'Le trajet maison de Cap.', 'Le trajet maison de Tapiroute.')
WHERE author_id = '00000000-0000-0000-0000-000000000ca9';
