import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSmartRoute, getRoutingStatus } from '../utils/smartRouting';

export default function SmartRouter({ targetRoute = null }) {
  const navigate = useNavigate();
  const { patient, weeklyPhotos } = useAuth();
  const [isRouting, setIsRouting] = useState(true);
  const [routingStatus, setRoutingStatus] = useState(null);

  useEffect(() => {
    const performSmartRouting = async () => {
      if (!patient) {
        navigate('/login');
        return;
      }

      try {
        setIsRouting(true);

        // If a specific target route is provided (like from WhatsApp deep link), use it
        if (targetRoute) {
          navigate(targetRoute);
          return;
        }

        // Otherwise, use smart routing logic — pass weeklyPhotos so the photo-day
        // redirect check can use the already-loaded server data
        const route = await getSmartRoute(patient, new Date(), weeklyPhotos);
        const status = await getRoutingStatus(patient);
        
        setRoutingStatus(status);
        
        // Navigate to the determined route
        navigate(route);
        
      } catch (error) {
        console.error('Smart routing error:', error);
        // Fallback to home
        navigate('/');
      } finally {
        setIsRouting(false);
      }
    };

    performSmartRouting();
  }, [patient, targetRoute, navigate]);

  // Show loading state while routing
  if (isRouting) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#c44033] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-gray-600">
            <div className="font-medium">Finding your way...</div>
            {routingStatus && (
              <div className="text-sm text-gray-500 mt-2">
                {routingStatus.window} Window • AM: {routingStatus.amDone ? '✓' : '○'} PM: {routingStatus.pmDone ? '✓' : '○'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // This component doesn't render anything once routing is complete
  return null;
}

// Hook for smart routing
export function useSmartRouting() {
  const navigate = useNavigate();
  const { patient, weeklyPhotos } = useAuth();

  const navigateSmart = async (targetRoute = null) => {
    try {
      if (!patient) {
        navigate('/login');
        return;
      }

      // If a specific target route is provided, use it
      if (targetRoute) {
        navigate(targetRoute);
        return;
      }

      // Otherwise, use smart routing logic
      const route = await getSmartRoute(patient, new Date(), weeklyPhotos);
      navigate(route);
      
    } catch (error) {
      console.error('Smart routing error:', error);
      navigate('/');
    }
  };

  return { navigateSmart };
}
