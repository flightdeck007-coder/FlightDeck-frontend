// Route constants for FlightDeck
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  MEETING: (id: string) => `/meeting/${id}`,
  OVERVIEW: '/dashboard/overview',
  MEETINGS: '/dashboard/meetings',
  ORGANIZATIONS: '/dashboard/organizations',
  ORGANIZATIONS_MEMBERS: '/dashboard/organizations/members',
  TEAMS: '/dashboard/teams',
  TODOS: '/dashboard/todos',
  ROCKS: '/dashboard/rocks',
  ISSUES: '/dashboard/issues',
  SCORECARD: '/dashboard/scorecard',
} as const;
