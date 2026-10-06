/** Admin panel routes used by the tests. */
export const routes = {
  dashboard: '/admin/dashboard',
  login: '/admin/login',
  boards: {
    callCenter: '/admin/lead-funnels/1',
    community: '/admin/lead-funnels/2',
    administration: '/admin/lead-funnels/administration/leads',
  },
  group: (id: string) => `/admin/groups/${id}`,
  student: (id: string) => `/admin/students/${id}`,
  lead: (id: string) => `/admin/leads/${id}`,
  suitableGroups: (leadId: string) => `/admin/leads/${leadId}/choose-a-suitable-group/active`,
  waitingList: '/admin/waiting',
  placementTests: '/admin/placement-test',
  placementTestCreate: '/admin/placement-test/create',
  placementTest: (id: string) => `/admin/placement-test/${id}`,
} as const;
