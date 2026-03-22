-- ============================================================
-- Fix product prices to realistic Brazilian market values
-- Based on product name patterns (March 2026 estimates)
-- ============================================================

UPDATE public.products
SET price = ROUND(CASE

  -- ── CPUs Intel ──────────────────────────────────────────────────────────
  WHEN name ILIKE '%Core i9%14%'                                THEN (2800 + RANDOM() * 800)
  WHEN name ILIKE '%Core i9%13%'                                THEN (2400 + RANDOM() * 600)
  WHEN name ILIKE '%Core i9%12%'                                THEN (2100 + RANDOM() * 500)
  WHEN name ILIKE '%Core i9%'                                   THEN (2400 + RANDOM() * 700)

  WHEN name ILIKE '%Core i7%14%'                                THEN (1700 + RANDOM() * 500)
  WHEN name ILIKE '%Core i7%13%'                                THEN (1500 + RANDOM() * 450)
  WHEN name ILIKE '%Core i7%12%'                                THEN (1300 + RANDOM() * 400)
  WHEN name ILIKE '%Core i7%'                                   THEN (1400 + RANDOM() * 450)

  WHEN name ILIKE '%Core i5%14%'                                THEN (950  + RANDOM() * 300)
  WHEN name ILIKE '%Core i5%13%'                                THEN (880  + RANDOM() * 280)
  WHEN name ILIKE '%Core i5%12%'                                THEN (780  + RANDOM() * 250)
  WHEN name ILIKE '%Core i5%'                                   THEN (850  + RANDOM() * 280)

  WHEN name ILIKE '%Core i3%14%'                                THEN (580  + RANDOM() * 180)
  WHEN name ILIKE '%Core i3%13%'                                THEN (540  + RANDOM() * 160)
  WHEN name ILIKE '%Core i3%12%'                                THEN (500  + RANDOM() * 150)
  WHEN name ILIKE '%Core i3%'                                   THEN (520  + RANDOM() * 180)

  -- ── CPUs AMD Ryzen ────────────────────────────────────────────────────────
  WHEN name ILIKE '%Ryzen 9%9%'                                 THEN (2200 + RANDOM() * 700)
  WHEN name ILIKE '%Ryzen 9%7%'                                 THEN (1900 + RANDOM() * 600)
  WHEN name ILIKE '%Ryzen 9%5%'                                 THEN (1400 + RANDOM() * 400)
  WHEN name ILIKE '%Ryzen 9%'                                   THEN (1700 + RANDOM() * 500)

  WHEN name ILIKE '%Ryzen 7%9%'                                 THEN (1400 + RANDOM() * 400)
  WHEN name ILIKE '%Ryzen 7%7%'                                 THEN (1200 + RANDOM() * 350)
  WHEN name ILIKE '%Ryzen 7%5%'                                 THEN (880  + RANDOM() * 250)
  WHEN name ILIKE '%Ryzen 7%'                                   THEN (1000 + RANDOM() * 300)

  WHEN name ILIKE '%Ryzen 5%9%'                                 THEN (900  + RANDOM() * 250)
  WHEN name ILIKE '%Ryzen 5%7%'                                 THEN (780  + RANDOM() * 220)
  WHEN name ILIKE '%Ryzen 5%5%'                                 THEN (620  + RANDOM() * 180)
  WHEN name ILIKE '%Ryzen 5%'                                   THEN (650  + RANDOM() * 200)

  WHEN name ILIKE '%Ryzen 3%'                                   THEN (370  + RANDOM() * 140)

  -- ── GPUs Nvidia ───────────────────────────────────────────────────────────
  WHEN name ILIKE '%RTX 4090%'                                  THEN (9800 + RANDOM() * 2000)
  WHEN name ILIKE '%RTX 4080 Super%'                            THEN (7000 + RANDOM() * 1200)
  WHEN name ILIKE '%RTX 4080%'                                  THEN (6200 + RANDOM() * 1200)
  WHEN name ILIKE '%RTX 4070 Ti Super%'                         THEN (4800 + RANDOM() * 800)
  WHEN name ILIKE '%RTX 4070 Ti%'                               THEN (4200 + RANDOM() * 700)
  WHEN name ILIKE '%RTX 4070 Super%'                            THEN (3500 + RANDOM() * 600)
  WHEN name ILIKE '%RTX 4070%'                                  THEN (2900 + RANDOM() * 500)
  WHEN name ILIKE '%RTX 4060 Ti%'                               THEN (2400 + RANDOM() * 400)
  WHEN name ILIKE '%RTX 4060%'                                  THEN (1800 + RANDOM() * 350)
  WHEN name ILIKE '%RTX 4050%'                                  THEN (1500 + RANDOM() * 300)
  WHEN name ILIKE '%RTX 3090 Ti%'                               THEN (5500 + RANDOM() * 1000)
  WHEN name ILIKE '%RTX 3090%'                                  THEN (4800 + RANDOM() * 900)
  WHEN name ILIKE '%RTX 3080 Ti%'                               THEN (4000 + RANDOM() * 800)
  WHEN name ILIKE '%RTX 3080%'                                  THEN (3400 + RANDOM() * 700)
  WHEN name ILIKE '%RTX 3070 Ti%'                               THEN (2600 + RANDOM() * 500)
  WHEN name ILIKE '%RTX 3070%'                                  THEN (2300 + RANDOM() * 450)
  WHEN name ILIKE '%RTX 3060 Ti%'                               THEN (1900 + RANDOM() * 350)
  WHEN name ILIKE '%RTX 3060%'                                  THEN (1650 + RANDOM() * 300)
  WHEN name ILIKE '%RTX 3050%'                                  THEN (1350 + RANDOM() * 250)
  WHEN name ILIKE '%GTX 1660 Super%'                            THEN (1100 + RANDOM() * 200)
  WHEN name ILIKE '%GTX 1660 Ti%'                               THEN (1000 + RANDOM() * 200)
  WHEN name ILIKE '%GTX 1660%'                                  THEN (900  + RANDOM() * 180)
  WHEN name ILIKE '%GTX 1650%'                                  THEN (750  + RANDOM() * 150)

  -- ── GPUs AMD ──────────────────────────────────────────────────────────────
  WHEN name ILIKE '%RX 7900 XTX%'                               THEN (5200 + RANDOM() * 1000)
  WHEN name ILIKE '%RX 7900 XT%'                                THEN (4400 + RANDOM() * 800)
  WHEN name ILIKE '%RX 7900 GRE%'                               THEN (3600 + RANDOM() * 600)
  WHEN name ILIKE '%RX 7800 XT%'                                THEN (2700 + RANDOM() * 500)
  WHEN name ILIKE '%RX 7700 XT%'                                THEN (2200 + RANDOM() * 400)
  WHEN name ILIKE '%RX 7600 XT%'                                THEN (1700 + RANDOM() * 300)
  WHEN name ILIKE '%RX 7600%'                                   THEN (1550 + RANDOM() * 280)
  WHEN name ILIKE '%RX 6950 XT%'                                THEN (3200 + RANDOM() * 600)
  WHEN name ILIKE '%RX 6900 XT%'                                THEN (2800 + RANDOM() * 500)
  WHEN name ILIKE '%RX 6800 XT%'                                THEN (2400 + RANDOM() * 450)
  WHEN name ILIKE '%RX 6800%'                                   THEN (2100 + RANDOM() * 400)
  WHEN name ILIKE '%RX 6700 XT%'                                THEN (1800 + RANDOM() * 350)
  WHEN name ILIKE '%RX 6700%'                                   THEN (1600 + RANDOM() * 300)
  WHEN name ILIKE '%RX 6600 XT%'                                THEN (1400 + RANDOM() * 250)
  WHEN name ILIKE '%RX 6600%'                                   THEN (1250 + RANDOM() * 220)
  WHEN name ILIKE '%RX 6500 XT%'                                THEN (850  + RANDOM() * 200)

  -- ── Motherboards by chipset (Intel) ──────────────────────────────────────
  WHEN name ILIKE '%Z790%'                                      THEN (850  + RANDOM() * 600)
  WHEN name ILIKE '%Z690%'                                      THEN (700  + RANDOM() * 500)
  WHEN name ILIKE '%B760%'                                      THEN (450  + RANDOM() * 200)
  WHEN name ILIKE '%H770%' OR name ILIKE '%H670%'               THEN (500  + RANDOM() * 200)
  WHEN name ILIKE '%B660%'                                      THEN (400  + RANDOM() * 180)
  WHEN name ILIKE '%H610%'                                      THEN (320  + RANDOM() * 130)

  -- ── Motherboards by chipset (AMD) ────────────────────────────────────────
  WHEN name ILIKE '%X670E%'                                     THEN (1200 + RANDOM() * 600)
  WHEN name ILIKE '%X670%'                                      THEN (950  + RANDOM() * 450)
  WHEN name ILIKE '%B650E%'                                     THEN (700  + RANDOM() * 300)
  WHEN name ILIKE '%B650%'                                      THEN (520  + RANDOM() * 250)
  WHEN name ILIKE '%A620%'                                      THEN (330  + RANDOM() * 150)
  WHEN name ILIKE '%X570%'                                      THEN (600  + RANDOM() * 280)
  WHEN name ILIKE '%B550%'                                      THEN (420  + RANDOM() * 190)
  WHEN name ILIKE '%B450%'                                      THEN (290  + RANDOM() * 140)

  -- ── RAM by capacity and type ──────────────────────────────────────────────
  WHEN name ILIKE '%DDR5%64%'  OR name ILIKE '%64%DDR5%'        THEN (1100 + RANDOM() * 400)
  WHEN name ILIKE '%DDR5%32%'  OR name ILIKE '%32%DDR5%'        THEN (580  + RANDOM() * 250)
  WHEN name ILIKE '%DDR5%16%'  OR name ILIKE '%16%DDR5%'        THEN (320  + RANDOM() * 120)
  WHEN name ILIKE '%DDR4%64%'  OR name ILIKE '%64%DDR4%'        THEN (780  + RANDOM() * 300)
  WHEN name ILIKE '%DDR4%32%'  OR name ILIKE '%32%DDR4%'        THEN (420  + RANDOM() * 180)
  WHEN name ILIKE '%DDR4%16%'  OR name ILIKE '%16%DDR4%'        THEN (240  + RANDOM() * 100)
  WHEN name ILIKE '%DDR4%8%'   OR name ILIKE '%8%DDR4%'         THEN (130  + RANDOM() * 60)
  WHEN name ILIKE '%DDR5%'                                      THEN (380  + RANDOM() * 150)
  WHEN name ILIKE '%DDR4%'                                      THEN (260  + RANDOM() * 110)

  -- ── SSDs ──────────────────────────────────────────────────────────────────
  WHEN (name ILIKE '%4TB%' OR name ILIKE '%4000GB%') AND
       (name ILIKE '%NVMe%' OR name ILIKE '%PCIe%' OR name ILIKE '%M.2%')  THEN (1100 + RANDOM() * 400)
  WHEN (name ILIKE '%2TB%' OR name ILIKE '%2000GB%') AND
       (name ILIKE '%NVMe%' OR name ILIKE '%PCIe%' OR name ILIKE '%M.2%')  THEN (560  + RANDOM() * 220)
  WHEN (name ILIKE '%1TB%' OR name ILIKE '%1000GB%') AND
       (name ILIKE '%NVMe%' OR name ILIKE '%PCIe%' OR name ILIKE '%M.2%')  THEN (320  + RANDOM() * 130)
  WHEN (name ILIKE '%512GB%' OR name ILIKE '%500GB%' OR name ILIKE '%480GB%') AND
       (name ILIKE '%NVMe%' OR name ILIKE '%PCIe%' OR name ILIKE '%M.2%')  THEN (210  + RANDOM() * 90)
  WHEN (name ILIKE '%4TB%')  AND (name ILIKE '%SATA%' OR name ILIKE '%SSD%') THEN (850  + RANDOM() * 280)
  WHEN (name ILIKE '%2TB%')  AND (name ILIKE '%SATA%' OR name ILIKE '%SSD%') THEN (450  + RANDOM() * 180)
  WHEN (name ILIKE '%1TB%')  AND (name ILIKE '%SATA%' OR name ILIKE '%SSD%') THEN (270  + RANDOM() * 100)
  WHEN (name ILIKE '%512GB%' OR name ILIKE '%500GB%' OR name ILIKE '%480GB%')
       AND (name ILIKE '%SATA%' OR name ILIKE '%SSD%')                       THEN (180  + RANDOM() * 70)

  -- ── HDDs ──────────────────────────────────────────────────────────────────
  WHEN name ILIKE '%8TB%'  AND name ILIKE '%HDD%'               THEN (750  + RANDOM() * 250)
  WHEN name ILIKE '%4TB%'  AND name ILIKE '%HDD%'               THEN (420  + RANDOM() * 150)
  WHEN name ILIKE '%2TB%'  AND name ILIKE '%HDD%'               THEN (270  + RANDOM() * 100)
  WHEN name ILIKE '%1TB%'  AND name ILIKE '%HDD%'               THEN (200  + RANDOM() * 80)

  -- ── PSUs by wattage ───────────────────────────────────────────────────────
  WHEN name ILIKE '%1600W%' OR name ILIKE '%1200W%'             THEN (1000 + RANDOM() * 400)
  WHEN name ILIKE '%1000W%'                                     THEN (680  + RANDOM() * 280)
  WHEN name ILIKE '%850W%'  OR name ILIKE '%900W%'              THEN (480  + RANDOM() * 220)
  WHEN name ILIKE '%750W%'                                      THEN (380  + RANDOM() * 170)
  WHEN name ILIKE '%650W%'                                      THEN (290  + RANDOM() * 140)
  WHEN name ILIKE '%600W%'  OR name ILIKE '%550W%'              THEN (240  + RANDOM() * 110)
  WHEN name ILIKE '%500W%'  OR name ILIKE '%450W%'              THEN (195  + RANDOM() * 90)

  -- ── Cases ─────────────────────────────────────────────────────────────────
  WHEN name ILIKE '%Full Tower%' OR name ILIKE '%Full-Tower%'   THEN (650  + RANDOM() * 450)
  WHEN name ILIKE '%Mid Tower%'  OR name ILIKE '%Mid-Tower%'    THEN (380  + RANDOM() * 320)
  WHEN name ILIKE '%mATX%'       AND
       (name ILIKE '%Gabinete%'  OR name ILIKE '%Case%')        THEN (260  + RANDOM() * 220)
  WHEN name ILIKE '%ITX%'        AND
       (name ILIKE '%Gabinete%'  OR name ILIKE '%Case%')        THEN (290  + RANDOM() * 260)
  WHEN name ILIKE '%Gabinete%'   OR name ILIKE '%Case%'         THEN (330  + RANDOM() * 350)

  -- ── CPU Coolers ───────────────────────────────────────────────────────────
  WHEN name ILIKE '%AIO%360%'    OR name ILIKE '%360mm%'        THEN (580  + RANDOM() * 350)
  WHEN name ILIKE '%AIO%280%'    OR name ILIKE '%280mm%'        THEN (480  + RANDOM() * 280)
  WHEN name ILIKE '%AIO%240%'    OR name ILIKE '%240mm%'        THEN (380  + RANDOM() * 250)
  WHEN name ILIKE '%AIO%120%'    OR name ILIKE '%120mm%' AND name ILIKE '%AIO%' THEN (260 + RANDOM() * 150)
  WHEN name ILIKE '%Cooler%'     OR name ILIKE '%Air Cooler%'   THEN (180  + RANDOM() * 200)

  -- ── Monitors ─────────────────────────────────────────────────────────────
  WHEN (name ILIKE '%Monitor%' OR name ILIKE '%Display%') AND
       (name ILIKE '%32%' OR name ILIKE '%31%')                 THEN (1600 + RANDOM() * 1200)
  WHEN (name ILIKE '%Monitor%' OR name ILIKE '%Display%') AND
       (name ILIKE '%27%' OR name ILIKE '%28%')                 THEN (1100 + RANDOM() * 900)
  WHEN (name ILIKE '%Monitor%' OR name ILIKE '%Display%') AND
       (name ILIKE '%24%' OR name ILIKE '%25%')                 THEN (800  + RANDOM() * 700)
  WHEN name ILIKE '%Monitor%'                                   THEN (700  + RANDOM() * 600)

  -- ── Keyboards & Mice ─────────────────────────────────────────────────────
  WHEN name ILIKE '%Teclado%Mecânico%' OR name ILIKE '%Mechanical%Keyboard%' THEN (280 + RANDOM() * 350)
  WHEN name ILIKE '%Teclado%'          OR name ILIKE '%Keyboard%'            THEN (150 + RANDOM() * 200)
  WHEN name ILIKE '%Mouse%Gaming%'     OR name ILIKE '%Mouse%Gamer%'         THEN (180 + RANDOM() * 250)
  WHEN name ILIKE '%Mouse%'                                                   THEN (100 + RANDOM() * 150)

  -- ── Headsets ─────────────────────────────────────────────────────────────
  WHEN name ILIKE '%Headset%' OR name ILIKE '%Fone%'            THEN (200  + RANDOM() * 400)

  ELSE price  -- don't touch anything that didn't match
END::numeric, 2)
WHERE active = true
  AND (
    -- Only fix products where we have a matching pattern
    name ILIKE '%Core i%'
    OR name ILIKE '%Ryzen%'
    OR name ILIKE '%RTX%' OR name ILIKE '%GTX%'
    OR name ILIKE '%RX 7%' OR name ILIKE '%RX 6%' OR name ILIKE '%RX 5%'
    OR name ILIKE '%Z790%' OR name ILIKE '%Z690%' OR name ILIKE '%B760%'
    OR name ILIKE '%B660%' OR name ILIKE '%H610%' OR name ILIKE '%H670%'
    OR name ILIKE '%X670%' OR name ILIKE '%B650%' OR name ILIKE '%A620%'
    OR name ILIKE '%X570%' OR name ILIKE '%B550%' OR name ILIKE '%B450%'
    OR name ILIKE '%DDR4%' OR name ILIKE '%DDR5%'
    OR name ILIKE '%NVMe%' OR name ILIKE '%PCIe%' OR name ILIKE '%SATA%' OR name ILIKE '%SSD%' OR name ILIKE '%HDD%'
    OR name ILIKE '%Fonte%' OR name ILIKE '%PSU%'
    OR (name ILIKE '%W%' AND (name ILIKE '%450W%' OR name ILIKE '%550W%' OR name ILIKE '%650W%'
        OR name ILIKE '%750W%' OR name ILIKE '%850W%' OR name ILIKE '%1000W%'))
    OR name ILIKE '%Gabinete%' OR name ILIKE '%Case%'
    OR name ILIKE '%Cooler%' OR name ILIKE '%AIO%'
    OR name ILIKE '%Monitor%'
    OR name ILIKE '%Teclado%' OR name ILIKE '%Mouse%' OR name ILIKE '%Headset%'
  );
