import { hashPassword, initials } from './security.js';
import { classifyIncident, computePriority, detectDuplicate, categoryLabel } from './ai.js';

const DEMO_PASSWORD = 'Demo@123';

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ZONES = [
  { name: 'Central Chennai', lat: 13.072, lng: 80.251 },
  { name: 'North Chennai', lat: 13.112, lng: 80.245 },
  { name: 'South Chennai', lat: 13.015, lng: 80.235 },
  { name: 'West Chennai', lat: 13.062, lng: 80.195 },
  { name: 'East Coast', lat: 13.055, lng: 80.285 },
  { name: 'Industrial Belt', lat: 13.128, lng: 80.285 },
  { name: 'Suburban South', lat: 12.965, lng: 80.215 },
];

const USERS = [
  ['Aarav Menon', 'admin@offgrid.in', 'admin', 'Platform Administrator', 'Central Chennai', '#f26430', '+91 98400 11001'],
  ['Meera Iyer', 'authority@offgrid.in', 'authority', 'District Disaster Management Officer', 'Central Chennai', '#3b7ff5', '+91 98400 11002'],
  ['Karthik Raj', 'responder@offgrid.in', 'responder', 'Rescue Team Lead · Alpha-1', 'North Chennai', '#0f9b8e', '+91 98400 11003'],
  ['Dr. Priya Nair', 'hospital@offgrid.in', 'hospital', 'Emergency Operations Coordinator', 'Central Chennai', '#a263e8', '+91 98400 11004'],
  ['Dr. Arjun Selvan', 'medical@offgrid.in', 'medical', 'Field Medical Lead · Med-2', 'South Chennai', '#e5484d', '+91 98400 11005'],
  ['Ananya Krishnan', 'citizen@offgrid.in', 'citizen', 'Verified Citizen Reporter', 'East Coast', '#e9a426', '+91 98400 11006'],
  ['Divya Balakrishnan', 'divya.r@offgrid.in', 'authority', 'Incident Commander · Night Shift', 'East Coast', '#5b7fe8', '+91 98400 11007'],
  ['Ravi Shankar', 'ravi.s@offgrid.in', 'responder', 'Swift Water Rescue Specialist', 'North Chennai', '#0f9b8e', '+91 98400 11008'],
  ['Sangeetha Murugan', 'sangeetha.m@offgrid.in', 'responder', 'Fire & Rescue Officer', 'West Chennai', '#f26430', '+91 98400 11009'],
  ['Naveen Kumar', 'naveen.k@offgrid.in', 'responder', 'USAR Technician', 'Industrial Belt', '#a263e8', '+91 98400 11010'],
  ['Fatima Rahman', 'fatima.r@offgrid.in', 'medical', 'Paramedic · Med-2', 'South Chennai', '#e5484d', '+91 98400 11011'],
  ['Vikram Prasad', 'vikram.p@offgrid.in', 'responder', 'Drone Surveillance Pilot', 'Central Chennai', '#3b7ff5', '+91 98400 11012'],
  ['Lakshmi Devi', 'lakshmi.d@offgrid.in', 'hospital', 'Bed Management Lead', 'West Chennai', '#a263e8', '+91 98400 11013'],
  ['Dr. Sanjay Rao', 'sanjay.rao@offgrid.in', 'medical', 'Trauma Surgeon', 'Central Chennai', '#e5484d', '+91 98400 11014'],
  ['Joseph Fernando', 'joseph.f@offgrid.in', 'responder', 'Logistics Coordinator', 'Suburban South', '#0f9b8e', '+91 98400 11015'],
  ['Prakash Velu', 'prakash.v@offgrid.in', 'citizen', 'Verified Citizen Reporter', 'South Chennai', '#e9a426', '+91 98400 11016'],
  ['Kavya Sundaram', 'kavya.s@offgrid.in', 'citizen', 'Verified Citizen Reporter', 'North Chennai', '#e9a426', '+91 98400 11017'],
  ['Harish Babu', 'harish.b@offgrid.in', 'citizen', 'Verified Citizen Reporter', 'West Chennai', '#e9a426', '+91 98400 11018'],
  ['Rekha Natarajan', 'rekha.n@offgrid.in', 'authority', 'Zonal Coordination Officer', 'Suburban South', '#3b7ff5', '+91 98400 11019'],
  ['Imran Khan', 'imran.k@offgrid.in', 'responder', 'Power & Utilities Engineer', 'Industrial Belt', '#0f9b8e', '+91 98400 11020'],
  ['Dr. Shalini Pillai', 'shalini.p@offgrid.in', 'hospital', 'ICU Coordinator', 'South Chennai', '#a263e8', '+91 98400 11021'],
  ['Mohan Das', 'mohan.d@offgrid.in', 'citizen', 'Verified Citizen Reporter', 'East Coast', '#e9a426', '+91 98400 11022'],
  ['Geetha Raman', 'geetha.r@offgrid.in', 'admin', 'Platform Operations Analyst', 'Central Chennai', '#f26430', '+91 98400 11023'],
  ['Suresh Kannan', 'suresh.k@offgrid.in', 'responder', 'Evacuation & Relief Lead', 'Suburban South', '#0f9b8e', '+91 98400 11024'],
];

const TEAMS = [
  ['Alpha-1 Swift Water Rescue', 'ALP-01', 'Water Rescue', 'North Chennai', 'Karthik Raj', 'deployed', 5, 8, 3, 13.1102, 80.2482, ['flood rescue', 'boat operations', 'swift water'], ['Inflatable boats', 'Life jackets', 'Throw ropes'], '+91 98400 21001'],
  ['Bravo-2 Fire & Rescue', 'BRV-02', 'Fire & Rescue', 'West Chennai', 'Sangeetha Murugan', 'available', 6, 9, 0, 13.0641, 80.1984, ['fire suppression', 'extrication', 'accident'], ['Fire tender', 'Hydraulic cutters', 'Thermal camera'], '+91 98400 21002'],
  ['Med-2 Mobile Trauma Unit', 'MED-02', 'Medical Response', 'South Chennai', 'Dr. Arjun Selvan', 'deployed', 4, 6, 2, 13.0212, 80.2371, ['triage', 'trauma', 'medical', 'ambulance'], ['Defibrillators', 'Trauma kits', 'Oxygen'], '+91 98400 21003'],
  ['Delta-4 Urban Search & Rescue', 'DLT-04', 'Urban Search & Rescue', 'Industrial Belt', 'Naveen Kumar', 'standby', 5, 7, 0, 13.1253, 80.2801, ['structural', 'collapse', 'confined space'], ['Ground radar', 'Hydraulic jacks', 'Cutting tools'], '+91 98400 21004'],
  ['Echo-5 Drone Surveillance', 'ECH-05', 'Drone Surveillance', 'Central Chennai', 'Vikram Prasad', 'available', 3, 4, 0, 13.0743, 80.2542, ['aerial survey', 'missing person', 'thermal imaging'], ['Thermal drones', 'Mapping software'], '+91 98400 21005'],
  ['Foxtrot-6 Evacuation & Relief', 'FOX-06', 'Evacuation & Relief', 'Suburban South', 'Suresh Kannan', 'deployed', 8, 12, 2, 12.9712, 80.2184, ['evacuation', 'shelter', 'relief'], ['Buses', 'Ration kits', 'Blankets'], '+91 98400 21006'],
  ['Golf-7 Power & Utilities', 'GLF-07', 'Power & Utilities', 'East Coast', 'Imran Khan', 'available', 4, 6, 0, 13.0582, 80.2813, ['power restoration', 'utility', 'pump'], ['Generators', 'Cable kits', 'Dewatering pumps'], '+91 98400 21007'],
  ['Hotel-8 Hazmat Response', 'HOT-08', 'Hazmat', 'Industrial Belt', 'Ravi Shankar', 'standby', 4, 5, 0, 13.1321, 80.2912, ['chemical', 'hazard', 'decontamination'], ['Hazmat suits', 'Gas detectors'], '+91 98400 21008'],
  ['India-9 Coastal Patrol', 'IND-09', 'Water Rescue', 'East Coast', 'Joseph Fernando', 'available', 5, 7, 0, 13.0481, 80.2932, ['coastal rescue', 'flood', 'boat operations'], ['Rescue boats', 'VHF radios'], '+91 98400 21009'],
  ['Juliet-3 Medical Evac', 'JUL-03', 'Medical Response', 'Central Chennai', 'Fatima Rahman', 'standby', 4, 6, 0, 13.0812, 80.2445, ['ambulance', 'patient transfer', 'triage'], ['ICU ambulance', 'Ventilators'], '+91 98400 21010'],
];

const HOSPITALS = [
  ['Rajiv Gandhi Government General Hospital', 'RGGGH', 'Central Chennai', 13.0792, 80.2491, 'Park Town, Egmore', 1200, 184, 120, 12, 340, 'Level I Trauma', 'operational', '+91 44 2530 5000'],
  ['Stanley Medical College Hospital', 'SMCH', 'North Chennai', 13.1191, 80.2498, 'Old Jail Road, Washermanpet', 820, 96, 64, 8, 210, 'Level I Trauma', 'operational', '+91 44 2528 1212'],
  ['Apollo Hospitals Greams Road', 'APGH', 'Central Chennai', 13.0641, 80.2539, 'Greams Road, Thousand Lights', 560, 72, 88, 21, 180, 'Level I Trauma', 'operational', '+91 44 2829 3333'],
  ['Fortis Malar Hospital', 'FMLR', 'South Chennai', 13.0122, 80.2452, 'Gandhi Nagar, Adyar', 280, 41, 36, 9, 96, 'Level II Trauma', 'operational', '+91 44 4289 2222'],
  ['Kauvery Hospital Alwarpet', 'KAVR', 'South Chennai', 13.0388, 80.2461, 'Alwarpet, Teynampet', 300, 58, 42, 11, 120, 'Level II Trauma', 'operational', '+91 44 4000 6000'],
  ['Sri Ramachandra Medical Centre', 'SRMC', 'West Chennai', 13.0392, 80.1871, 'Porur, Ramachandra Nagar', 700, 132, 76, 24, 260, 'Level I Trauma', 'operational', '+91 44 2476 8888'],
  ['Government Kilpauk Medical College', 'GKMC', 'West Chennai', 13.0808, 80.2301, 'Kilpauk, Chennai', 480, 63, 40, 7, 140, 'Level II Trauma', 'limited', '+91 44 2643 0030'],
];

const RESOURCES = [
  ['Inflatable rescue boats', 'Rescue Equipment', 14, 'boats', 8, 'North Chennai', 'State Disaster Response Fund', 'available'],
  ['Portable defibrillators', 'Medical', 22, 'units', 12, 'Central Chennai', 'MedTech Supplies', 'available'],
  ['Oxygen cylinders', 'Medical', 86, 'cylinders', 60, 'South Chennai', 'Chennai Oxygen Ltd.', 'available'],
  ['Trauma kits', 'Medical', 148, 'kits', 60, 'Central Chennai', 'MedTech Supplies', 'available'],
  ['Sandbags', 'Flood Control', 240, 'bags', 500, 'East Coast', 'PWD Chennai', 'low'],
  ['Dewatering pumps', 'Flood Control', 9, 'pumps', 12, 'North Chennai', 'PWD Chennai', 'low'],
  ['Emergency ration packs', 'Relief', 3200, 'packs', 1500, 'Suburban South', 'TN Civil Supplies', 'available'],
  ['Satellite phones', 'Communication', 11, 'units', 8, 'Central Chennai', 'BSNL Emergency Cell', 'available'],
  ['Portable generators', 'Power', 7, 'units', 10, 'Industrial Belt', 'TNEB', 'low'],
  ['Thermal blankets', 'Relief', 980, 'blankets', 400, 'West Chennai', 'TN Civil Supplies', 'available'],
  ['Blood packs (O+)', 'Medical', 64, 'packs', 40, 'Central Chennai', 'Red Cross Chennai', 'available'],
  ['ICU ambulances', 'Transport', 6, 'vehicles', 4, 'South Chennai', '108 Emergency Services', 'available'],
  ['Gas detectors', 'Hazmat', 5, 'units', 8, 'Industrial Belt', 'Industrial Safety Board', 'low'],
  ['High-capacity life jackets', 'Rescue Equipment', 210, 'units', 120, 'East Coast', 'State Disaster Response Fund', 'available'],
];

const INCIDENT_TEMPLATES = [
  { hours: 0.18, title: 'Flash flood at Velachery underpass — people stranded on rooftops', desc: 'Heavy rain has flooded the Velachery underpass. At least 12 people are stranded on rooftops, water level rising fast. Two children and an elderly woman are with the group. Need swift water rescue boats immediately.', zone: 'South Chennai', addr: 'Velachery Bypass Underpass, near TCS Bridge', people: 12, vulnerable: 3, source: 'sos', status: 'in_progress', live: 1 },
  { hours: 0.31, title: 'Duplicate report: flooding at Velachery underpass, people stranded', desc: 'More flood water at Velachery underpass, several people stranded on rooftops including children. Rescue boats needed urgently, water rising.', zone: 'South Chennai', addr: 'Velachery Bypass Underpass', people: 10, vulnerable: 2, source: 'mobile', status: 'pending' },
  { hours: 0.52, title: 'Cardiac arrest reported at Marina Beach food court', desc: 'A 58-year-old man collapsed and is unconscious, not breathing. Bystander performing CPR. Request ambulance and defibrillator at the Marina Beach food court entrance.', zone: 'East Coast', addr: 'Marina Beach Food Court, Triplicane', people: 1, vulnerable: 1, source: 'call', status: 'assigned', live: 1 },
  { hours: 0.78, title: 'Multi-vehicle collision on Anna Salai near Gemini Circle', desc: 'A bus and three cars collided near Gemini Circle. Multiple injured, fuel spill on the road, traffic fully blocked. Extrication and trauma teams needed.', zone: 'Central Chennai', addr: 'Anna Salai, Gemini Circle', people: 18, vulnerable: 2, source: 'sensor', status: 'in_progress' },
  { hours: 1.1, title: 'Apartment building fire in Choolaimedu, residents trapped', desc: 'Thick smoke from a three-storey apartment building on fire in Choolaimedu. Residents on the second floor trapped and calling for help. Fire tender and evacuation needed.', zone: 'West Chennai', addr: 'Bashyam Street, Choolaimedu', people: 9, vulnerable: 2, source: 'call', status: 'assigned' },
  { hours: 1.4, title: 'Power outage affecting dialysis unit at Kilpauk clinic', desc: 'Transformer failure has caused a blackout around Kilpauk. A dialysis clinic reports its backup generator is failing and patients are on machines. Priority power restoration required.', zone: 'West Chennai', addr: 'Kilpauk Garden Road', people: 14, vulnerable: 8, source: 'web', status: 'triaged' },
  { hours: 1.8, title: 'Partial roof collapse at old warehouse in Perambur', desc: 'An old warehouse roof collapsed after overnight rain. Workers are trapped under debris and rubble. Heavy cutting equipment and urban search rescue needed.', zone: 'North Chennai', addr: 'Paper Mills Road, Perambur', people: 7, vulnerable: 0, source: 'call', status: 'in_progress' },
  { hours: 2.2, title: 'Elderly woman missing from evacuation shelter, Pallikaranai', desc: 'A 76-year-old woman with limited mobility was last seen leaving the Pallikaranai relief shelter at dawn. Drone surveillance and search teams requested.', zone: 'Suburban South', addr: 'Pallikaranai Marsh Road Relief Camp', people: 1, vulnerable: 1, source: 'web', status: 'triaged' },
  { hours: 2.8, title: 'Chemical smell and gas leak at Manali industrial unit', desc: 'Workers report a strong chemical gas leak and toxic cloud near an industrial unit in Manali. Eyes burning, evacuation in progress. Hazmat team required.', zone: 'Industrial Belt', addr: 'Manali Industrial Estate, Phase II', people: 32, vulnerable: 4, source: 'sensor', status: 'assigned' },
  { hours: 3.4, title: 'Canal overflow near Adyar, houses inundated', desc: 'The Adyar canal overflowed after sustained rain. Water has entered 20 houses in a low-lying settlement. Families need evacuation and sandbags.', zone: 'South Chennai', addr: 'Adyar Canal Bank, Karpagam Gardens', people: 46, vulnerable: 9, source: 'mobile', status: 'in_progress' },
  { hours: 4.1, title: 'Tree fall blocking ambulance route in Nungambakkam', desc: 'A large tree fell across Nungambakkam High Road in the storm, blocking the ambulance route to the trauma centre. Clearance crew needed.', zone: 'Central Chennai', addr: 'Nungambakkam High Road', people: 4, vulnerable: 0, source: 'web', status: 'resolved' },
  { hours: 5.2, title: 'Boat capsized near Ennore creek, three swimmers missing', desc: 'A small fishing boat capsized near Ennore creek during rough seas. Two people reached shore, three swimmers are missing. Coastal patrol and drone search needed.', zone: 'Industrial Belt', addr: 'Ennore Creek, North Jetty', people: 5, vulnerable: 1, source: 'sos', status: 'in_progress' },
  { hours: 6.4, title: 'Mass casualty triage requested at Tambaram railway crossing', desc: 'A suburban train brushed a goods vehicle near Tambaram crossing; around 24 passengers report injuries. Medical teams request triage support and ICU bed availability.', zone: 'Suburban South', addr: 'Tambaram LC-42 Railway Crossing', people: 24, vulnerable: 3, source: 'call', status: 'assigned' },
  { hours: 7.6, title: 'Water supply pipeline burst in Royapettah', desc: 'A major pipeline burst has flooded Royapettah streets and cut water supply to two wards. Dewatering pumps and utility crew requested.', zone: 'Central Chennai', addr: 'Royapettah High Road', people: 60, vulnerable: 6, source: 'web', status: 'triaged' },
  { hours: 9.1, title: 'Streetlight live wire down after storm in Besant Nagar', desc: 'A live electrical wire from a damaged streetlight is lying across a residential lane after the storm. Risk of electrocution, area needs isolation.', zone: 'East Coast', addr: 'Besant Nagar 7th Avenue', people: 8, vulnerable: 3, source: 'mobile', status: 'resolved' },
  { hours: 11.5, title: 'Landslide risk on Porur slope after heavy rain', desc: 'Residents report soil movement and cracks on the Porur slope after continuous rain. Two houses at risk, preventive evacuation advised.', zone: 'West Chennai', addr: 'Porur Hillside Colony', people: 11, vulnerable: 4, source: 'web', status: 'triaged' },
  { hours: 15, title: 'Fire in textile godown, Kodambakkam', desc: 'Smoke and flames reported from a textile godown in Kodambakkam. Fire tender on site, adjacent buildings being evacuated.', zone: 'West Chennai', addr: 'Kodambakkam Industrial Lane', people: 15, vulnerable: 1, source: 'call', status: 'resolved' },
  { hours: 19, title: 'Floodwater entered ground floor of Saidapet hospital', desc: 'Floodwater has entered the ground floor of a private hospital in Saidapet. Patients being shifted to upper floors, dewatering pumps needed.', zone: 'South Chennai', addr: 'Saidapet West Jones Road', people: 38, vulnerable: 12, source: 'mobile', status: 'resolved' },
  { hours: 24, title: 'Two-wheeler accident with head injury, Guindy', desc: 'A two-wheeler collision near Guindy Kathipara junction. Rider has a head injury and is bleeding. Ambulance dispatched.', zone: 'South Chennai', addr: 'Kathipara Junction, Guindy', people: 2, vulnerable: 0, source: 'call', status: 'resolved' },
  { hours: 28, title: 'Storm drain blockage causing waterlogging in T. Nagar', desc: 'A blocked storm drain has caused severe waterlogging near T. Nagar market. Shopkeepers request pumping support.', zone: 'Central Chennai', addr: 'Usman Road, T. Nagar', people: 22, vulnerable: 2, source: 'web', status: 'resolved' },
  { hours: 33, title: 'Stranded family on rooftop, Washermanpet', desc: 'A family of five is stranded on a rooftop after floodwater surrounded their home in Washermanpet. Boat rescue completed, all safe.', zone: 'North Chennai', addr: 'Washermanpet 3rd Street', people: 5, vulnerable: 2, source: 'sos', status: 'closed' },
  { hours: 40, title: 'Generator failure at North Chennai relief camp', desc: 'The main generator at a relief camp failed, leaving 180 evacuees without light or charging. Replacement generator dispatched.', zone: 'North Chennai', addr: 'Tondiarpet Community Relief Camp', people: 180, vulnerable: 22, source: 'web', status: 'resolved' },
  { hours: 48, title: 'Suspected gas leak in apartment kitchen, Mylapore', desc: 'Residents reported a strong gas smell from an apartment kitchen in Mylapore. Building evacuated, utility team isolated the line.', zone: 'East Coast', addr: 'Mylapore Tank Farm Street', people: 16, vulnerable: 3, source: 'call', status: 'closed' },
  { hours: 55, title: 'Bus breakdown with schoolchildren in Ambattur', desc: 'A school bus broke down on a flooded stretch in Ambattur with 28 children aboard. Evacuation bus arranged, all children safe.', zone: 'West Chennai', addr: 'Ambattur Industrial Estate Road', people: 28, vulnerable: 28, source: 'mobile', status: 'closed' },
  { hours: 66, title: 'Road subsidence near Sholinganallur junction', desc: 'A section of road caved in near Sholinganallur junction after pipeline leakage. Traffic diverted, structural assessment done.', zone: 'Suburban South', addr: 'Sholinganallur IT Junction', people: 6, vulnerable: 0, source: 'sensor', status: 'resolved' },
  { hours: 74, title: 'Minor fire in electrical substation, Madipakkam', desc: 'A small electrical fire broke out in a substation panel at Madipakkam. Fire extinguished on site, power restored.', zone: 'South Chennai', addr: 'Madipakkam Substation', people: 3, vulnerable: 0, source: 'web', status: 'closed' },
  { hours: 92, title: 'Medical oxygen shortage reported at nursing home', desc: 'A nursing home in Triplicane reported low oxygen cylinder stock during the storm. Emergency delivery coordinated with supplier.', zone: 'East Coast', addr: 'Triplicane Big Street', people: 12, vulnerable: 6, source: 'web', status: 'resolved' },
  { hours: 108, title: 'Debris clearance after wall collapse, Egmore', desc: 'A compound wall collapsed onto a footpath in Egmore after heavy rain. No injuries, debris cleared by municipal crew.', zone: 'Central Chennai', addr: 'Egmore Pantheon Road', people: 2, vulnerable: 0, source: 'web', status: 'closed' },
  { hours: 132, title: 'Coastal surge warning — fishing hamlet evacuation', desc: 'High tide and storm surge warning for the fishing hamlet near Foreshore Estate. Preventive evacuation of 90 families completed.', zone: 'East Coast', addr: 'Foreshore Estate Fishing Hamlet', people: 90, vulnerable: 18, source: 'sensor', status: 'resolved' },
  { hours: 168, title: 'Flood relief distribution point request, Pallikaranai', desc: 'Relief camp volunteers requested additional ration packs and blankets for 240 evacuees in Pallikaranai. Logistics dispatched.', zone: 'Suburban South', addr: 'Pallikaranai Community Hall', people: 240, vulnerable: 35, source: 'web', status: 'closed' },
  { hours: 2.95, title: 'Duplicate report: chemical gas leak at Manali industrial unit', desc: 'Workers again report a strong chemical gas leak and toxic cloud near the industrial unit in Manali. Eyes burning and evacuation in progress, hazmat response required.', zone: 'Industrial Belt', addr: 'Manali Industrial Estate, Phase II', people: 28, vulnerable: 4, source: 'mobile', status: 'pending' },
];

const BROADCASTS = [
  ['Red alert: heavy rainfall and flash flood warning', 'IMD has issued a red alert for Chennai and adjoining districts. Avoid low-lying areas and underpasses. Relief shelters are open at Pallikaranai, Tondiarpet and Guindy. Call 112 for immediate assistance.', 'critical', ['Central Chennai', 'South Chennai', 'East Coast'], 'sent', 18420, 0.22],
  ['Velachery underpass closed to traffic', 'The Velachery Bypass underpass is waterlogged and closed until further notice. Use GST Road or Rajiv Gandhi Salai as alternate routes.', 'warning', ['South Chennai', 'Suburban South'], 'sent', 9420, 0.7],
  ['Relief shelter locations and helpline numbers', 'Community halls in Pallikaranai, Tondiarpet and Guindy are operating as relief shelters with food, water and medical desks. District helpline: 1070.', 'advisory', ['Central Chennai', 'North Chennai', 'South Chennai'], 'sent', 22150, 1.6],
  ['Advisory: avoid coastal stretch during high tide', 'High tide expected between 18:00 and 20:00. Fishermen and residents along the coast are advised to move inland and secure vessels.', 'advisory', ['East Coast', 'Industrial Belt'], 'sent', 6840, 3.2],
  ['Hospital surge capacity activated', 'All network hospitals have activated surge capacity. Elective procedures are deferred for 24 hours. Please use the emergency triage desk for incoming patients.', 'warning', ['Central Chennai', 'West Chennai', 'North Chennai'], 'sent', 3120, 5.5],
  ['Draft: post-storm safety inspection notice', 'Field teams will begin structural safety inspections of flood-affected buildings tomorrow from 08:00. Residents are requested to keep access clear.', 'advisory', ['South Chennai'], 'draft', 0, 8.4],
];

export function seedDatabase({ insert, run, get, all, now }) {
  const random = mulberry32(20261103);
  const jitter = (amount) => (random() - 0.5) * amount;
  const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60000).toISOString();
  const password = hashPassword(DEMO_PASSWORD);
  const createdAt = iso(18 * 24 * 60);

  const userIds = {};
  for (const [name, email, role, designation, zone, color, phone] of USERS) {
    const id = insert('users', {
      name, email, phone, password_hash: password, role, designation, zone,
      avatar_color: color, status: 'active', created_at: createdAt,
      last_active_at: iso(Math.round(random() * 240)),
    });
    userIds[email] = id;
  }

  const teamIds = [];
  for (const [name, code, type, zone, leader, status, capacity, members, active, lat, lng, skills, equipment, contact] of TEAMS) {
    teamIds.push(insert('teams', {
      name, code, type, zone, leader_name: leader, status, capacity, members, active_incidents: active,
      latitude: lat, longitude: lng, skills_json: JSON.stringify(skills), equipment_json: JSON.stringify(equipment),
      contact, created_at: iso(60 * 24 * 20),
    }));
  }

  // Attach responders to their demo teams.
  const teamAssignment = {
    'ravi.s@offgrid.in': teamIds[0],
    'sangeetha.m@offgrid.in': teamIds[1],
    'naveen.k@offgrid.in': teamIds[3],
    'vikram.p@offgrid.in': teamIds[4],
    'joseph.f@offgrid.in': teamIds[8],
    'imran.k@offgrid.in': teamIds[6],
    'fatima.r@offgrid.in': teamIds[2],
    'suresh.k@offgrid.in': teamIds[5],
  };
  for (const [email, teamId] of Object.entries(teamAssignment)) {
    run('UPDATE users SET team_id = ? WHERE id = ?', [teamId, userIds[email]]);
  }
  run('UPDATE users SET team_id = ? WHERE id = ?', [teamIds[0], userIds['responder@offgrid.in']]);

  const hospitalIds = [];
  for (const [name, code, zone, lat, lng, address, beds, bedsFree, icu, icuFree, oxygen, trauma, status, contact] of HOSPITALS) {
    hospitalIds.push(insert('hospitals', {
      name, code, zone, latitude: lat, longitude: lng, address,
      beds_total: beds, beds_available: bedsFree, icu_total: icu, icu_available: icuFree,
      oxygen_units: oxygen,
      blood_units_json: JSON.stringify({
        'O+': Math.round(20 + random() * 50), 'A+': Math.round(15 + random() * 40),
        'B+': Math.round(10 + random() * 35), 'O-': Math.round(4 + random() * 14),
      }),
      ambulances: Math.round(2 + random() * 6), trauma_level: trauma, status, contact,
      updated_at: iso(Math.round(random() * 180)),
    }));
  }

  for (const [name, category, quantity, unit, threshold, zone, supplier, status] of RESOURCES) {
    insert('resources', { name, category, quantity, unit, threshold, zone, supplier, status, updated_at: iso(Math.round(random() * 600)) });
  }

  const incidentIds = [];
  const incidentsForDuplicateCheck = [];
  INCIDENT_TEMPLATES.forEach((template, index) => {
    const zone = ZONES.find((z) => z.name === template.zone) || ZONES[0];
    const minutes = template.hours * 60;
    const created = iso(minutes);
    const classification = classifyIncident({ ...template, description: template.desc, title: template.title, source: template.source });
    const duplicate = detectDuplicate(
      { title: template.title, description: template.desc, category: classification.category, latitude: zone.lat + jitter(0.004), longitude: zone.lng + jitter(0.004), created_at: created },
      incidentsForDuplicateCheck,
    );
    const status = template.status;
    const acknowledgedAt = ['pending'].includes(status) ? null : iso(Math.max(1, minutes - Math.round(4 + random() * 12)));
    const resolvedAt = ['resolved', 'closed'].includes(status) ? iso(Math.max(1, minutes - Math.round(45 + random() * 220))) : null;
    const base = {
      code: `OG-26-${String(1041 + index).padStart(4, '0')}`,
      title: template.title,
      description: template.desc,
      category: classification.category,
      severity: classification.severity,
      priority_score: 0,
      status,
      source: template.source,
      reporter_id: userIds[index % 5 === 0 ? 'citizen@offgrid.in' : ['prakash.v@offgrid.in', 'kavya.s@offgrid.in', 'harish.b@offgrid.in', 'mohan.d@offgrid.in'][index % 4]],
      reporter_name: ['Ananya Krishnan', 'Prakash Velu', 'Kavya Sundaram', 'Harish Babu', 'Mohan Das'][index % 5],
      reporter_phone: `+91 98400 1${String(2000 + index).padStart(4, '0')}`,
      latitude: Number((zone.lat + jitter(0.012)).toFixed(5)),
      longitude: Number((zone.lng + jitter(0.014)).toFixed(5)),
      address: template.addr,
      zone: template.zone,
      people_affected: template.people,
      vulnerable_count: template.vulnerable,
      ai_confidence: classification.confidence,
      ai_reasoning_json: JSON.stringify(classification.reasoning),
      tags_json: JSON.stringify(classification.tags),
      duplicate_of: duplicate?.id || null,
      duplicate_score: duplicate?.score || null,
      assigned_team_id: null,
      assigned_hospital_id: null,
      live_location: template.live || 0,
      offline_synced: 0,
      sla_minutes: classification.slaMinutes,
      notes_json: JSON.stringify([]),
      created_at: created,
      updated_at: resolvedAt || iso(minutes - Math.round(random() * Math.min(20, minutes))),
      acknowledged_at: acknowledgedAt,
      resolved_at: resolvedAt,
    };
    if (['assigned', 'in_progress', 'resolved', 'closed'].includes(status)) {
      base.assigned_team_id = teamIds[index % teamIds.length];
    }
    if (classification.category === 'medical' || index % 6 === 3) {
      base.assigned_hospital_id = hospitalIds[index % hospitalIds.length];
    }
    base.priority_score = computePriority(base);
    const id = insert('incidents', base);
    incidentIds.push(id);
    incidentsForDuplicateCheck.push({ id, title: base.title, description: base.description, category: base.category, latitude: base.latitude, longitude: base.longitude, created_at: base.created_at, status: base.status });
  });

  // Realistic incident channel conversations.
  const conversations = [
    [0, [
      ['Meera Iyer', 'authority', 'Alpha-1 has been dispatched with two inflatable boats. ETA 9 minutes.', 'status'],
      ['Karthik Raj', 'responder', 'Copy. Approaching the underpass from the north side, water level is above knee depth.', 'text'],
      ['Ananya Krishnan', 'citizen', 'The group is on the terrace of the blue building. One child is asthmatic.', 'text'],
      ['Dr. Arjun Selvan', 'medical', 'Med-2 standing by at the staging point for triage after extraction.', 'text'],
    ]],
    [3, [
      ['Divya Balakrishnan', 'authority', 'Bravo-2 en route with hydraulic cutters. Please cordon off the fuel spill.', 'status'],
      ['Sangeetha Murugan', 'responder', 'On scene. Requesting two ambulances for walking wounded.', 'text'],
      ['Dr. Sanjay Rao', 'medical', 'RGGGH trauma bay 2 is prepped and ready for incoming patients.', 'text'],
    ]],
    [6, [
      ['Naveen Kumar', 'responder', 'Ground radar shows two heat signatures under the northern debris section.', 'text'],
      ['Meera Iyer', 'authority', 'Prioritise the northern section. Delta-4 has heavy lifting clearance.', 'status'],
      ['Karthik Raj', 'responder', 'Shoring team arriving in 6 minutes. Maintain a safe perimeter.', 'text'],
    ]],
    [8, [
      ['Imran Khan', 'responder', 'Gas detector readings elevated at the eastern gate. Evacuation widening to 300 metres.', 'text'],
      ['Dr. Arjun Selvan', 'medical', 'Setting up a decontamination and triage point at the upwind assembly area.', 'text'],
    ]],
    [9, [
      ['Joseph Fernando', 'responder', 'Two pumps deployed near Karpagam Gardens. Water receding slowly.', 'text'],
      ['Meera Iyer', 'authority', 'Foxtrot-6 is opening additional shelter capacity at Guindy community hall.', 'status'],
      ['Ananya Krishnan', 'citizen', 'Nine families have moved to the shelter. Thank you for the quick response.', 'text'],
    ]],
    [11, [
      ['Vikram Prasad', 'responder', 'Thermal drone sweep covering the creek mouth, visibility poor but scanning.', 'text'],
      ['Karthik Raj', 'responder', 'Coastal patrol boat launched from the north jetty.', 'text'],
    ]],
    [12, [
      ['Dr. Priya Nair', 'hospital', 'We can accept 8 green and 4 yellow triage patients at Fortis Malar.', 'text'],
      ['Fatima Rahman', 'medical', 'Confirming 12 patients inbound, first convoy departing in 5 minutes.', 'text'],
    ]],
    [2, [
      ['Dr. Arjun Selvan', 'medical', 'Med-2 has defibrillator on scene. CPR in progress.', 'status'],
      ['Dr. Priya Nair', 'hospital', 'Apollo emergency bay notified, cath lab on standby.', 'text'],
    ]],
    [4, [
      ['Sangeetha Murugan', 'responder', 'First floor cleared, second floor residents being led down the stairwell.', 'text'],
      ['Meera Iyer', 'authority', 'Keep the aerial ladder on the west face. Med-2 is staged.', 'status'],
    ]],
  ];
  for (const [incidentIndex, thread] of conversations) {
    thread.forEach(([author, role, body, kind], messageIndex) => {
      insert('messages', {
        incident_id: incidentIds[incidentIndex],
        user_id: null,
        author_name: author,
        author_role: role,
        body,
        kind,
        created_at: iso(Math.max(1, INCIDENT_TEMPLATES[incidentIndex].hours * 60 - (thread.length - messageIndex) * 4.5)),
      });
    });
  }

  for (const [title, body, level, zones, status, recipients, hours] of BROADCASTS) {
    insert('broadcasts', {
      title, body, level, zones_json: JSON.stringify(zones),
      channels_json: JSON.stringify(level === 'critical' ? ['app', 'sms', 'siren', 'radio'] : ['app', 'sms']),
      author_name: 'Meera Iyer', status, recipients, created_at: iso(hours * 60),
    });
  }

  const activityItems = [
    ['incident', 'New SOS received', 'Flash flood at Velachery underpass · South Chennai', 'Ananya Krishnan'],
    ['allocation', 'AI recommended Alpha-1', 'Speciality match, 1.4 km from incident, available capacity', 'OFFGRID AI'],
    ['dispatch', 'Team Alpha-1 dispatched', 'Swift water rescue · 2 boats · ETA 9 min', 'Meera Iyer'],
    ['duplicate', 'Possible duplicate flagged', 'OG-26-1042 overlaps with OG-26-1041 (91%)', 'OFFGRID AI'],
    ['hospital', 'Bed capacity updated', 'Fortis Malar: 41 general beds, 9 ICU beds available', 'Dr. Priya Nair'],
    ['incident', 'Incident escalated to CRITICAL', 'Multi-vehicle collision · 18 people affected', 'Divya Balakrishnan'],
    ['broadcast', 'Red alert broadcast sent', 'Heavy rainfall warning delivered to 18,420 recipients', 'Meera Iyer'],
    ['message', 'Field update received', 'Ground radar shows two heat signatures under debris', 'Naveen Kumar'],
    ['resource', 'Low stock alert', 'Sandbags below threshold at East Coast depot', 'OFFGRID System'],
    ['resolved', 'Incident resolved', 'Tree fall blocking ambulance route · Nungambakkam', 'Suresh Kannan'],
    ['incident', 'Medical emergency reported', 'Cardiac arrest at Marina Beach food court', 'OFFGRID System'],
    ['allocation', 'Med-2 auto-allocated', 'Medical response · 1.1 km · ETA 7 min', 'OFFGRID AI'],
    ['hospital', 'Surge capacity activated', 'All 7 network hospitals confirmed surge readiness', 'Dr. Priya Nair'],
    ['incident', 'Sensor alert ingested', 'Chemical gas reading above threshold at Manali', 'OFFGRID System'],
    ['resolved', 'Patients transferred', '12 triage patients received at Fortis Malar', 'Fatima Rahman'],
    ['team', 'Team returned to standby', 'Delta-4 USAR available for redeployment', 'Meera Iyer'],
    ['broadcast', 'Advisory published', 'Relief shelter locations and helpline numbers', 'Meera Iyer'],
    ['incident', 'Offline report synced', 'Report queued in Tiruvallur has been uploaded', 'OFFGRID System'],
  ];
  activityItems.forEach(([type, title, detail, actor], index) => {
    insert('activity', {
      type, title, detail, actor_name: actor, entity_type: type === 'incident' ? 'incident' : null,
      entity_id: type === 'incident' ? incidentIds[index % incidentIds.length] : null,
      created_at: iso(index * 11 + 2),
    });
  });

  const notificationItems = [
    ['Critical incident requires triage', 'Flash flood at Velachery underpass · 12 people affected', 'critical', 'incident'],
    ['Possible duplicate detected', 'Two reports of the same Velachery flooding incident', 'warning', 'incident'],
    ['Team dispatch confirmed', 'Alpha-1 is en route to OG-26-1041', 'info', 'team'],
    ['Hospital capacity alert', 'GKMC is at limited capacity — 7 ICU beds available', 'warning', 'hospital'],
    ['Low stock: sandbags', 'East Coast depot has 240 bags against a threshold of 500', 'warning', 'resource'],
    ['New field message', 'Naveen Kumar posted an update on the Perambur collapse', 'info', 'message'],
    ['Broadcast delivered', 'Red alert delivered to 18,420 recipients', 'success', 'broadcast'],
    ['SLA at risk', 'OG-26-1048 has been pending triage for 14 minutes', 'warning', 'incident'],
  ];
  for (const [title, body, kind, link] of notificationItems) {
    insert('notifications', { user_id: null, title, body, kind, link, read: 0, created_at: iso(Math.round(random() * 90)) });
  }

  for (const [key, value] of Object.entries({
    simulate_live: 'true',
    auto_allocate: 'true',
    duplicate_threshold: '0.34',
    network_name: 'Chennai Regional Emergency Network',
  })) {
    insert('settings', { key, value });
  }

  // Keep the seeded dataset honest: expose demo credentials in the README too.
  run("UPDATE users SET last_active_at = ? WHERE email = 'admin@offgrid.in'", [now()]);
  console.log(`[OFFGRID] Seeded ${USERS.length} users, ${TEAMS.length} teams, ${HOSPITALS.length} hospitals, ${INCIDENT_TEMPLATES.length} incidents.`);
}
