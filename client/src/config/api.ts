// API Configuration with fallback
export const API_CONFIG = {
  CREATE_TEST_URL: import.meta.env.VITE_CREATE_TEST_URL || 'https://ywvjpb2clrv35zzpuxbxaxu2gu0bmotk.lambda-url.us-west-2.on.aws',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  STRUCTURE_USERS: `${API_CONFIG.CREATE_TEST_URL}/structure-users`,
  GIVE_ACCESS: `${API_CONFIG.CREATE_TEST_URL}/give-access`,
  CREATE_DESCRIPTION: `${API_CONFIG.CREATE_TEST_URL}/create-description`,
  CREATE_COMPLETE_TEST: `${API_CONFIG.CREATE_TEST_URL}/create-complete-test`,
  QA: `${API_CONFIG.CREATE_TEST_URL}/qa`,
  RAPID_FIRE: `${API_CONFIG.CREATE_TEST_URL}/rapid-fire`,
  CONDUCTOR: `${API_CONFIG.CREATE_TEST_URL}/conductor`,
  TRIPLE_STEP: `${API_CONFIG.CREATE_TEST_URL}/triple-step`,
  GAMES_ARENA: `${API_CONFIG.CREATE_TEST_URL}/games-arena`,
} as const;
