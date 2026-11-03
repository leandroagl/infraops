const MODEL_NAMES: Record<string, string> = {
  // Access Points — Wi-Fi 7
  'U7LR':     'U7 Long Range',
  'U7PRO':    'U7 Pro',
  'U7WALL':   'U7 Wall',
  'U7PG':     'U7 Pro Max',
  // Access Points — Wi-Fi 6
  'UAL6':     'U6 Lite',
  'U6LR':     'U6 Long Range',
  'U6PRO':    'U6 Pro',
  'U6IW':     'U6 In-Wall',
  'U6EXT':    'U6 Extender',
  'U6M':      'U6 Mesh',
  // Access Points — Wi-Fi 5
  'UACP':     'UAP AC Pro',
  'UACLI':    'UAP AC Lite',
  'UAPHD':    'UAP AC HD',
  'UACIW':    'UAP AC IW',
  'UACM':     'UAP AC Mesh',
  'UACMPRO':  'UAP AC Mesh Pro',
  // Switches
  'US8':      'USW 8',
  'US8P60':   'USW 8 PoE',
  'US8P150':  'USW 8 PoE 150W',
  'US16P150': 'USW 16 PoE',
  'US24':     'USW 24',
  'US24250W': 'USW 24 PoE',
  'US24PRO':  'USW Pro 24 PoE',
  'US24PRO2': 'USW Pro 24 PoE Gen2',
  'US48':     'USW 48',
  'US48500W': 'USW 48 PoE',
  'US48PRO':  'USW Pro 48 PoE',
  // Gateways / Consoles
  'USG3P':    'USG 3P',
  'USG4PRO':  'USG Pro 4',
  'UDM':      'UDM',
  'UDMPRO':   'UDM Pro',
  'UDMSE':    'UDM SE',
  'UCGULTRA': 'UCG-Ultra',
};

export function resolveUnifiModelName(sku: string): string {
  return MODEL_NAMES[sku.toUpperCase()] ?? sku;
}
