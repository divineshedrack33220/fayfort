/**
 * Short, plain-English explanations shown when you hover an admin sidebar
 * entry: what the page is for, and what happens next in the sourcing flow.
 * Keyed by the nav item's href.
 */
export const NAV_HINTS: Record<string, string> = {
  "/admin":
    "A live snapshot of the sourcing pipeline — requests in flight, quote value, order totals and anything waiting on you. Start here each morning, then open Sourcing Requests to pick up the next piece of work.",
  "/admin/requests":
    "Every request customers have filed, from submission through review. Open one to check the details, then issue a quote — that moves it into Quotes and notifies the customer automatically.",
  "/admin/quotes":
    "The pricing you have sent to customers, with supplier, margin and expiry on each. When a customer accepts, the order is created for you and appears in Orders; a decline or silence can be re-quoted from here.",
  "/admin/orders":
    "Confirmed orders moving from production to delivery. Advancing a stage posts a milestone the customer sees on their dashboard, and a dispatched order generates its Shipments record.",
  "/admin/inspections":
    "Quality checks run before goods leave the factory — photos, sample results and pass or fail. Record a passed inspection to release the order for shipment.",
  "/admin/shipments":
    "Freight in transit and delivered, from factory to the customer's warehouse. Update a shipment as it moves; delivery closes the loop on the order.",
  "/admin/customers":
    "Everyone who has filed a request, with their order value and recent activity. Open a customer to see their requests, quotes and orders together.",
  "/admin/messages":
    "Support threads with customers. Replying here posts straight into their portal chat, and the red badge shows how many unread messages are waiting on you.",
  "/admin/analytics":
    "Trends over time: order value by month, most requested products, strongest customers and suppliers. Use it to spot demand shifts and sourcing opportunities.",
  "/admin/notifications":
    "A running feed of everything that happened — new requests, quotes, orders and customer replies. Open one to jump to the item it refers to, or mark them read once you have handled them.",
  "/admin/settings":
    "Workspace preferences for the staff console. Changes here apply to everyone using the console.",
};
