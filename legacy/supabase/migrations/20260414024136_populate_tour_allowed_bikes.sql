/*
  # Populate tour allowed bikes

  1. Data Changes
    - Assigns allowed bikes to each tour that requires bikes (needs_bike = true)
    - Mountain bike tours: Mountain Bikes + E-Bikes
    - E-bike city tours: E-Bikes only
    - Combo (hike & bike) tours: E-Bikes + Gravel Bikes
    - General bike tours: E-Bikes + Mountain Bikes + Gravel Bikes

  2. Important Notes
    - Only non-accessory bikes are assigned (no children seats or bags)
    - Accessories are excluded from tour bike selection
    - Children bikes are excluded from tour assignments
*/

INSERT INTO tour_allowed_bikes (tour_id, bike_id)
SELECT t.id, b.id
FROM tours t
CROSS JOIN bikes b
JOIN categories c ON c.id = b.category_id
WHERE t.needs_bike = true
  AND c.name NOT IN ('Accessories', 'Children Bikes')
  AND (
    (t.name LIKE '%Mountain Bike%' AND c.name IN ('Mountain Bikes', 'E-Bikes'))
    OR (t.name LIKE '%E-bike%' AND c.name = 'E-Bikes')
    OR (t.activity_type = 'combo' AND c.name IN ('E-Bikes', 'Gravel Bikes'))
    OR (t.name IN ('Historical Kirkjubo', 'Viewpoint Nordadalsskard') AND c.name IN ('E-Bikes', 'Mountain Bikes', 'Gravel Bikes'))
  )
ON CONFLICT DO NOTHING;