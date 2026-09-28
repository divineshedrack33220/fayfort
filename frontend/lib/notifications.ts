export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  requestId?: string;
}

/**
 * Reference notification items for the bell dropdown and inbox; live updates
 * come from the backend. Kept for tests and local development.
 */
export const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    title: "Wireless Headphones — In Review",
    body: "Our sourcing team has picked up your request and is reviewing the brief.",
    at: "2 min ago",
    read: false,
    requestId: "REQ-1047",
  },
  {
    id: "n2",
    title: "Handbags — quote ready",
    body: "A quote is waiting for you over on My Requests.",
    at: "1 hour ago",
    read: false,
    requestId: "REQ-1036",
  },
  {
    id: "n3",
    title: "Sneakers — converted",
    body: "Your request was confirmed and has become an active order.",
    at: "2 days ago",
    read: true,
    requestId: "REQ-1030",
  },
  {
    id: "n4",
    title: "Welcome to the portal",
    body: "Track requests, chat with the team and check estimates here.",
    at: "Sep 20",
    read: true,
  },
];

export const unreadCount = (items: NotificationItem[]): number =>
  items.filter((item) => !item.read).length;

export const markAllRead = (items: NotificationItem[]): NotificationItem[] =>
  items.map((item) => ({ ...item, read: true }));