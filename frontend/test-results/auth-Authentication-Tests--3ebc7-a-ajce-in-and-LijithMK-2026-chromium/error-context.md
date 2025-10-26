# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e6]:
      - link "FreshCart" [ref=e8] [cursor=pointer]:
        - /url: /delivery
        - generic [ref=e9]: FreshCart
      - generic [ref=e10]:
        - generic [ref=e12]:
          - generic [ref=e13]: Welcome, lijith
          - generic [ref=e14]: User
        - generic [ref=e15]:
          - link "Delivery Panel" [ref=e16] [cursor=pointer]:
            - /url: /delivery
          - link "My Profile" [ref=e17] [cursor=pointer]:
            - /url: /delivery/profile
          - button "Logout" [ref=e18] [cursor=pointer]
  - main [ref=e19]:
    - generic [ref=e21]:
      - generic [ref=e22]:
        - generic [ref=e23]: 🚫
        - heading "Verification Required" [level=2] [ref=e24]
        - paragraph [ref=e25]: You need to complete the delivery partner verification process to access the dashboard.
        - generic [ref=e26]:
          - button "Complete Verification" [ref=e27] [cursor=pointer]
          - button "Logout" [ref=e28] [cursor=pointer]
      - paragraph [ref=e30]: Need help? Contact support for assistance.
```