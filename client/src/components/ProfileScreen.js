import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Phone, FileText, ShoppingBag, MessageCircle } from 'lucide-react';

export default function ProfileScreen() {
  const { patient } = useAuth();

  if (!patient) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    );
  }

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent(`Hi ${patient.coachName}, this is ${patient.name}. I have a question about my skin journey.`);
    window.open(`https://wa.me/${patient.coachWhatsApp}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-24">
      <div className="bg-white px-6 py-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Patient Info */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#c44033]/10 flex items-center justify-center">
              <User className="w-8 h-8 text-[#c44033]" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{patient.name}</h2>
              <p className="text-sm text-gray-500">{patient.concern}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-[#c44033]/10 text-[#c44033] text-xs font-medium rounded-full">{patient.planType}</span>
            </div>
          </div>
        </div>

        {/* Coach */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#c44033]" />
            Your Skin Coach
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{patient.coachName}</p>
              <p className="text-sm text-gray-500">Available on WhatsApp</p>
            </div>
            <button onClick={handleWhatsAppClick} className="p-3 bg-green-500 rounded-xl text-white hover:bg-green-600 transition-colors">
              <Phone className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Products */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#c44033]" />
            Your Products
          </h3>
          <div className="space-y-3">
            {patient.products?.length > 0 ? patient.products.map((product) => (
              <div key={product.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${product.category === 'AM' ? 'bg-orange-100 text-orange-700' : product.category === 'PM' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>{product.category}</span>
                </div>
              </div>
            )) : <p className="text-gray-500 text-sm">No products assigned yet</p>}
          </div>
        </div>

        {/* Diet Plan */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#c44033]" />
            Diet Plan
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Version</span>
              <span className="font-medium">{patient.dietPlan?.version || 'Not assigned'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Category</span>
              <span className="font-medium">{patient.dietPlan?.category || '-'}</span>
            </div>
            {patient.dietPlan?.restrictions?.length > 0 && (
              <div>
                <span className="text-gray-600 text-sm">Restrictions</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {patient.dietPlan.restrictions.map((restriction) => (
                    <span key={restriction} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full">{restriction}</span>
                  ))}
                </div>
              </div>
            )}
            {/* Dietician Details */}
            {patient.dietPlan?.dieticianName && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#c44033]/10 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-[#c44033]" />
                  </span>
                  Your Dietician
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">Name</span>
                    <span className="font-medium">{patient.dietPlan.dieticianName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">Phone</span>
                    <span className="font-medium">{patient.dietPlan.dieticianPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">Email</span>
                    <span className="font-medium">{patient.dietPlan.dieticianEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">WhatsApp</span>
                    <span className="font-medium">{patient.dietPlan.dieticianWhatsApp}</span>
                  </div>
                  {patient.dietPlan.mealPlan && (
                    <div className="mt-3">
                      <span className="text-gray-600 text-sm">Meal Plan</span>
                      <p className="mt-1 p-3 bg-gray-50 rounded-lg text-sm">{patient.dietPlan.mealPlan}</p>
                    </div>
                  )}
                  {patient.dietPlan.notes && (
                    <div className="mt-3">
                      <span className="text-gray-600 text-sm">Notes</span>
                      <p className="mt-1 p-3 bg-yellow-50 rounded-lg text-sm">{patient.dietPlan.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
