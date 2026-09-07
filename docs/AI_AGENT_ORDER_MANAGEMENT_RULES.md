# AI Shopping Agent – Complete Order Management Specification

Implement the following conversation and business logic for the AI shopping assistant.

---

# 1. Price Inquiry Flow

Whenever a customer asks for the price of a product:

1. Provide the product price.
2. Immediately ask whether they would like to purchase the product.

Example:

* Customer: "How much is this?"
* AI: "This product costs $25. Would you like to buy it?"

---

# 2. Buying a Product

When a customer expresses that they want to buy a product:

1. Tell them the product price (if it has not already been provided).
2. Ask how many units they would like to purchase.
3. Wait for the customer to specify the quantity.
4. Do **not** assume a default quantity.

Example:

AI:
"The product costs $25. How many would you like to buy?"

---

# 3. Adding Products to the Cart

A product should **only** be added to the cart after all of the following conditions are met:

1. The customer has selected a product.
2. The customer has specified the desired quantity.
3. The AI asks for confirmation before adding the product to the cart.
4. The customer explicitly confirms.

Example:

AI:
"Would you like me to add 3 units of Product A to your cart?"

Customer:
"Yes."

Action:

* Add Product A to the cart.
* Set its quantity to **3**.

Never add a product to the cart before receiving explicit confirmation.

---

# 4. Updating Cart Quantities

* The quantity stored in the cart must always match the quantity explicitly provided by the customer.
* Never guess or automatically increase quantities.
* If the customer changes the quantity later, update the cart accordingly.

Example:

Customer:
"Actually, make it 5."

Action:

* Update the cart quantity to **5**.

---

# 5. Checkout Information Collection

Before an order can be confirmed, the AI must collect:

* Shipping address
* Phone number

If either piece of information is missing, the AI must request it before proceeding.

---

# 6. Order Confirmation Flow

When the customer says they want to confirm or place the order:

1. Display a complete order summary containing:

   * Every product currently in the cart
   * Quantity of each product
   * Unit price
   * Total price
   * Shipping address
   * Phone number

2. Ask for one final confirmation.

Example:

Order Summary

* Product A × 2
* Product B × 1

Address:
...

Phone:
...

Total:
...

"Would you like to confirm this order?"

Do **not** create the order until the customer explicitly confirms.

---

# 7. Creating an Order

After the customer explicitly confirms:

1. Generate a new order using the current cart contents.
2. Save the order in the website's Orders list.
3. Set the initial order status to **Processing**.
4. Decrease inventory for every ordered product.
5. Clear the customer's cart.
6. Display the completed order details.
7. Thank the customer.

Example:

"Your order has been placed successfully.

Order Details:
...

Thank you for shopping with us!"

---

# 8. Order Status Management

Every order must always have one of the following statuses:

* Processing
* On the Way
* Delivered
* Cancelled

No other order status values should be used.

Status progression should generally follow:

Processing → On the Way → Delivered

An order may also transition to:

Processing → Cancelled

or

On the Way → Cancelled

(if cancellation is still allowed by business rules).

---

# 9. Order Cancellation

If a customer requests to cancel an order:

1. Find the requested order.
2. Update its status to **Cancelled**.
3. Save the updated status in the Orders list.
4. Restore the inventory quantities for every product in that order.
5. Inform the customer that the cancellation was successful.

Delivered orders should generally not be cancellable unless business rules explicitly allow it.

---

# 10. Inventory Management

Inventory must always stay synchronized with confirmed orders.

### When an order is created

Decrease inventory by the ordered quantity.

Example:

Inventory = 25

Order = 3 units

Remaining inventory = 22

### When an order is cancelled

Restore the cancelled quantities.

Example:

Inventory after ordering = 22

Cancelled order = 3 units

Updated inventory = 25

Inventory must **never** change when:

* Products are added to the cart
* Products are removed from the cart
* Cart quantities are modified

Inventory changes only occur after:

* A confirmed order is created
* A confirmed order is cancelled

---

# 11. Cart Behavior

The cart is temporary.

It should:

* Store products before checkout.
* Store customer-selected quantities.
* Allow updates and removals.
* Not affect inventory.

After a successful order is generated:

* The cart must be completely cleared.
* All purchased items should only exist within the newly created order.

---

# 12. Ongoing Orders Section

Below the Cart section, create a new UI section called **Ongoing Orders**.

This section should automatically display all of the current customer's orders whose status is:

* Processing
* On the Way

It should **not** display:

* Delivered orders
* Cancelled orders

Each ongoing order should display relevant information such as:

* Order ID
* Products
* Quantities
* Current status
* Order date
* Total amount

The AI agent should be able to answer customer questions about any order shown in the Ongoing Orders section, including questions such as:

* "Where is my order?"
* "What did I order?"
* "How many items are in my order?"
* "What's the status of my order?"
* "Can I cancel this order?"
* "When was it placed?"

The AI should retrieve information directly from the customer's ongoing orders rather than relying on conversation history.

---

# 13. Required Conversation Rules

The AI must **never**:

* Add products to the cart without customer confirmation.
* Assume product quantities.
* Confirm an order without collecting address and phone number.
* Create an order without explicit customer confirmation.
* Modify inventory before an order is confirmed.
* Clear the cart before the order has been successfully created.

The AI must **always**:

* Provide the product price when asked.
* Ask whether the customer wants to purchase after providing the price.
* Ask for the desired quantity.
* Confirm before adding products to the cart.
* Use the customer's confirmed quantity when updating the cart.
* Collect address and phone number before checkout.
* Display a final order summary before creating an order.
* Generate an order from the cart only after final confirmation.
* Set the initial order status to **Processing**.
* Clear the cart after successfully generating the order.
* Update inventory correctly when orders are confirmed or cancelled.
* Maintain accurate order statuses.
* Answer customer questions using the Ongoing Orders data whenever possible.
* Thank the customer after a successful purchase.