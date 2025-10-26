import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

// Simple inline icons to avoid extra deps
const IconUser = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16 14a4 4 0 10-8 0v1a7 7 0 0016 0v-1a4 4 0 10-8 0z" />
    <circle cx="12" cy="8" r="4" strokeWidth="2" />
  </svg>
);

const IconStore = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 7l1.5-3h15L21 7M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7M5 7h14M7 12h10" />
  </svg>
);

const IconTruck = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 7h10v8H3zM13 9h5l3 3v3h-8V9zM5.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
  </svg>
);

const IconShield = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7l8-4z" />
  </svg>
);

const roles = [
  { id: "customer", label: "Customer", icon: IconUser, to: "/register/customer" },
  { id: "seller", label: "Seller", icon: IconStore, to: "/register/store" },
  { id: "delivery", label: "Delivery", icon: IconTruck, to: "/register/delivery" },
  { id: "admin", label: "Admin", icon: IconShield, to: "/register/admin" },
];

export default function RoleRegister() {
  const [selected, setSelected] = useState("customer");
  const navigate = useNavigate();

  const handleContinue = () => {
    const dest = roles.find((r) => r.id === selected)?.to || "/register";
    navigate(dest);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white shadow">
            <span className="text-xl font-bold">★</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Welcome to FreshCart</h1>
          <p className="text-gray-600">Create your account to continue</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <p className="text-sm text-gray-700 mb-3">I am a:</p>

          {/* Segmented role selector */}
          <div className="flex flex-wrap gap-2 bg-gray-100 p-2 rounded-xl">
            {roles.map(({ id, label, icon: Icon }) => {
              const active = id === selected;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    active
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                  aria-pressed={active}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Hint / description */}
          <div className="mt-6 text-sm text-gray-600">
            {selected === "customer" && (
              <p>Shop fresh products as a customer. Quick account creation with email and phone.</p>
            )}
            {selected === "seller" && (
              <p>Register your store and start selling. You&apos;ll add store details and product categories.</p>
            )}
            {selected === "delivery" && (
              <p>Join as a delivery partner. Provide vehicle and license information to proceed.</p>
            )}
            {selected === "admin" && (
              <p>Admin access requires elevated approval and verification.</p>
            )}
          </div>

          {/* Continue */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleContinue}
              className="inline-flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition shadow"
            >
              Continue
            </button>
            <Link to="/login" className="text-green-700 hover:text-green-800 font-semibold">
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}