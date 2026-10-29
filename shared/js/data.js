// Archivo GENERADO desde database/medilink.db — no editar a mano.
// Para actualizarlo: cd database && python export_data.py
const H = [
 {
  "id": 1,
  "name": "Hospital San Martín",
  "addr": "Av. Belgrano 1200",
  "city": "San Miguel de Tucumán",
  "phone": "0381 555-0101",
  "hours": [
   {
    "l": "Lunes a viernes",
    "d": [
     1,
     2,
     3,
     4,
     5
    ],
    "f": 7,
    "t": 20,
    "x": "07:00 – 20:00"
   },
   {
    "l": "Sábados",
    "d": [
     6
    ],
    "f": 8,
    "t": 13,
    "x": "08:00 – 13:00"
   }
  ],
  "note": "Guardia las 24 hs"
 },
 {
  "id": 2,
  "name": "Clínica del Norte",
  "addr": "Av. Mate de Luna 2450",
  "city": "Yerba Buena",
  "phone": "0381 555-0102",
  "hours": [
   {
    "l": "Lunes a viernes",
    "d": [
     1,
     2,
     3,
     4,
     5
    ],
    "f": 8,
    "t": 19,
    "x": "08:00 – 19:00"
   },
   {
    "l": "Sábados",
    "d": [
     6
    ],
    "f": 9,
    "t": 13,
    "x": "09:00 – 13:00"
   }
  ],
  "note": ""
 },
 {
  "id": 3,
  "name": "Sanatorio Central",
  "addr": "24 de Septiembre 800",
  "city": "San Miguel de Tucumán",
  "phone": "0381 555-0103",
  "hours": [
   {
    "l": "Lunes a sábado",
    "d": [
     1,
     2,
     3,
     4,
     5,
     6
    ],
    "f": 7,
    "t": 21,
    "x": "07:00 – 21:00"
   }
  ],
  "note": "Domingos solo guardia"
 },
 {
  "id": 4,
  "name": "Hospital de Niños",
  "addr": "Av. Mitre 950",
  "city": "San Miguel de Tucumán",
  "phone": "0381 555-0104",
  "hours": [
   {
    "l": "Lunes a viernes",
    "d": [
     1,
     2,
     3,
     4,
     5
    ],
    "f": 7,
    "t": 18,
    "x": "07:00 – 18:00"
   }
  ],
  "note": "Guardia pediátrica 24 hs"
 },
 {
  "id": 5,
  "name": "Centro de Salud Belgrano",
  "addr": "Av. Roca 300",
  "city": "Concepción",
  "phone": "0381 555-0105",
  "hours": [
   {
    "l": "Lunes a viernes",
    "d": [
     1,
     2,
     3,
     4,
     5
    ],
    "f": 8,
    "t": 16,
    "x": "08:00 – 16:00"
   }
  ],
  "note": ""
 }
];

const P = [
 {
  "id": 1,
  "name": "Dr. Juan Pérez",
  "spec": "Cardiología",
  "city": "San Miguel de Tucumán",
  "hosps": [
   1
  ],
  "exp": 18,
  "bg": "blue",
  "reviews": [
   {
    "a": "Marta L.",
    "r": 5,
    "t": "Excelente atención, muy claro con las explicaciones.",
    "d": "2026-09-24"
   },
   {
    "a": "Diego R.",
    "r": 5,
    "t": "Puntual y atento, me tranquilizó mucho.",
    "d": "2026-09-08"
   },
   {
    "a": "Sofía T.",
    "r": 4,
    "t": "Muy buen profesional, la espera fue larga.",
    "d": "2026-08-09"
   }
  ]
 },
 {
  "id": 2,
  "name": "Dra. Marisa Suárez",
  "spec": "Cardiología",
  "city": "Yerba Buena",
  "hosps": [
   2,
   3
  ],
  "exp": 12,
  "bg": "mint",
  "reviews": [
   {
    "a": "Carlos M.",
    "r": 5,
    "t": "Muy buena predisposición y trato humano.",
    "d": "2026-09-17"
   },
   {
    "a": "Lorena V.",
    "r": 4,
    "t": "Explica todo con paciencia.",
    "d": "2026-08-09"
   },
   {
    "a": "Pedro A.",
    "r": 4,
    "t": "Buena atención en ambos lugares.",
    "d": "2026-06-10"
   }
  ]
 },
 {
  "id": 3,
  "name": "Dr. Roberto Gómez",
  "spec": "Cardiología",
  "city": "Tafí Viejo",
  "hosps": [
   3
  ],
  "exp": 25,
  "bg": "green",
  "reviews": [
   {
    "a": "Elena G.",
    "r": 5,
    "t": "El mejor cardiólogo que consulté.",
    "d": "2026-10-01"
   },
   {
    "a": "Raúl S.",
    "r": 5,
    "t": "Muy profesional, 25 años de experiencia se notan.",
    "d": "2026-09-08"
   },
   {
    "a": "Ana P.",
    "r": 5,
    "t": "Me solucionó lo que otros no pudieron.",
    "d": "2026-07-10"
   }
  ]
 },
 {
  "id": 4,
  "name": "Dra. Lucía Fernández",
  "spec": "Pediatría",
  "city": "San Miguel de Tucumán",
  "hosps": [
   4
  ],
  "exp": 9,
  "bg": "mint",
  "reviews": [
   {
    "a": "Julia B.",
    "r": 5,
    "t": "Muy paciente con los chicos, mi hija se sintió cómoda.",
    "d": "2026-09-24"
   },
   {
    "a": "Martín C.",
    "r": 5,
    "t": "Súper amable y clara.",
    "d": "2026-09-08"
   },
   {
    "a": "Romina D.",
    "r": 4,
    "t": "Muy buena, aunque cuesta conseguir turno.",
    "d": "2026-08-09"
   }
  ]
 },
 {
  "id": 5,
  "name": "Dr. Martín Acosta",
  "spec": "Dermatología",
  "city": "Yerba Buena",
  "hosps": [
   2
  ],
  "exp": 11,
  "bg": "blue",
  "reviews": [
   {
    "a": "Nadia F.",
    "r": 4,
    "t": "Diagnóstico rápido y preciso.",
    "d": "2026-09-08"
   },
   {
    "a": "Luis H.",
    "r": 5,
    "t": "Resolvió mi problema de piel en pocas visitas.",
    "d": "2026-08-09"
   },
   {
    "a": "Camila O.",
    "r": 4,
    "t": "Buen trato, consultorio ordenado.",
    "d": "2026-07-10"
   }
  ]
 },
 {
  "id": 6,
  "name": "Dra. Carla Núñez",
  "spec": "Clínica Médica",
  "city": "Concepción",
  "hosps": [
   5
  ],
  "exp": 7,
  "bg": "green",
  "reviews": [
   {
    "a": "Rosa T.",
    "r": 4,
    "t": "Atención cálida y clara.",
    "d": "2026-09-17"
   },
   {
    "a": "Hugo N.",
    "r": 4,
    "t": "Muy dedicada con cada paciente.",
    "d": "2026-08-09"
   },
   {
    "a": "Silvia E.",
    "r": 5,
    "t": "Me escuchó con calma, excelente.",
    "d": "2026-05-11"
   }
  ]
 },
 {
  "id": 7,
  "name": "Dr. Ezequiel Ramos",
  "spec": "Traumatología",
  "city": "San Miguel de Tucumán",
  "hosps": [
   1
  ],
  "exp": 14,
  "bg": "blue",
  "reviews": [
   {
    "a": "Franco Q.",
    "r": 5,
    "t": "Resolvió mi lesión rápido.",
    "d": "2026-09-24"
   },
   {
    "a": "Paula R.",
    "r": 4,
    "t": "Muy bueno, me explicó la rehabilitación.",
    "d": "2026-09-08"
   },
   {
    "a": "Iván K.",
    "r": 4,
    "t": "Recomendable.",
    "d": "2026-07-10"
   }
  ]
 },
 {
  "id": 8,
  "name": "Dra. Valentina Ríos",
  "spec": "Ginecología",
  "city": "Yerba Buena",
  "hosps": [
   2
  ],
  "exp": 10,
  "bg": "mint",
  "reviews": [
   {
    "a": "Agustina M.",
    "r": 5,
    "t": "Muy profesional y respetuosa.",
    "d": "2026-10-01"
   },
   {
    "a": "Gisela L.",
    "r": 5,
    "t": "Te hace sentir cómoda en todo momento.",
    "d": "2026-09-08"
   },
   {
    "a": "Belén C.",
    "r": 4,
    "t": "Excelente atención.",
    "d": "2026-08-09"
   }
  ]
 },
 {
  "id": 9,
  "name": "Dr. Ignacio Molina",
  "spec": "Oftalmología",
  "city": "Tafí Viejo",
  "hosps": [
   3
  ],
  "exp": 16,
  "bg": "green",
  "reviews": [
   {
    "a": "Oscar D.",
    "r": 4,
    "t": "Buen trato y explicación detallada.",
    "d": "2026-09-08"
   },
   {
    "a": "Marina J.",
    "r": 5,
    "t": "Muy minucioso con los estudios.",
    "d": "2026-08-09"
   },
   {
    "a": "Tomás W.",
    "r": 4,
    "t": "Atento y puntual.",
    "d": "2026-06-10"
   }
  ]
 }
];
