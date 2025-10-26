import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from './ui/button';
import { Navigation } from 'lucide-react';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const normalizeCoordinates = (coords) => {
  if (!coords) return null;

  if (Array.isArray(coords) && coords.length >= 2) {
    const [lat, lng] = coords;
    if (lat == null || lng == null) return null;
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) return null;
    return [parsedLat, parsedLng];
  }

  if (typeof coords === 'object' && coords.lat != null && coords.lng != null) {
    const parsedLat = Number(coords.lat);
    const parsedLng = Number(coords.lng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) return null;
    return [parsedLat, parsedLng];
  }

  return null;
};

const coordinatesAreEqual = (coords1, coords2) => {
  if (!coords1 && !coords2) return true;
  if (!coords1 || !coords2) return false;
  return coords1[0] === coords2[0] && coords1[1] === coords2[1];
};

// Temporary alias to avoid runtime errors if cached bundles still reference the old name
const areCoordinatesEqual = coordinatesAreEqual;

function MapController({ mapCenter }) {
  const map = useMap();

  useEffect(() => {
    if (mapCenter) {
      map.setView(mapCenter, 15);
    }
  }, [mapCenter, map]);

  return null;
}

function LocationMarker({ position, setPosition, initialPosition }) {
  const [markerPosition, setMarkerPosition] = useState(() => normalizeCoordinates(position) ?? normalizeCoordinates(initialPosition));

  useEffect(() => {
    setMarkerPosition((prev) => {
      const normalizedPosition = normalizeCoordinates(position);
      if (normalizedPosition) {
        return coordinatesAreEqual(prev, normalizedPosition) ? prev : normalizedPosition;
      }
      const normalizedInitial = normalizeCoordinates(initialPosition);
      if (normalizedInitial) {
        return coordinatesAreEqual(prev, normalizedInitial) ? prev : normalizedInitial;
      }
      return prev ?? null;
    });
  }, [position, initialPosition]);

  useMapEvents({
    click(e) {
      const newPos = [e.latlng.lat, e.latlng.lng];
      setMarkerPosition(newPos);
      setPosition(newPos);
    },
  });

  if (!markerPosition) {
    return null;
  }

  const [lat, lng] = markerPosition;

  return (
    <Marker position={markerPosition}>
      <Popup>
        Selected Location<br />
        {typeof lat === 'number' && typeof lng === 'number' ? (
          <>
            Lat: {lat.toFixed(6)}<br />
            Lng: {lng.toFixed(6)}
          </>
        ) : (
          'Unable to display coordinates'
        )}
      </Popup>
    </Marker>
  );
}

export function MapPicker({ onLocationSelect, initialLocation, className, radiusMeters }) {
  const [position, setPosition] = useState(() => normalizeCoordinates(initialLocation));
  const [mapCenter, setMapCenter] = useState(() => normalizeCoordinates(initialLocation) ?? [20.5937, 78.9629]); // Center of India
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [circleOverlay, setCircleOverlay] = useState(null);
  const mapRef = useRef(null);
  
  // Track if we've initialized to prevent calling callback on mount
  const hasInitialized = useRef(false);
  const prevPositionRef = useRef(null);

  // Initialize position from initialLocation only once on mount
  useEffect(() => {
    if (hasInitialized.current) return;

    const normalizedInitial = normalizeCoordinates(initialLocation);

    if (normalizedInitial) {
      setPosition(normalizedInitial);
      setMapCenter(normalizedInitial);
      prevPositionRef.current = normalizedInitial;
      hasInitialized.current = true;
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCoords = normalizeCoordinates([pos.coords.latitude, pos.coords.longitude]);
          if (newCoords) {
            setPosition(newCoords);
            setMapCenter(newCoords);
            prevPositionRef.current = newCoords;
          }
          hasInitialized.current = true;
        },
        (err) => {
          console.log('Geolocation error:', err);
          hasInitialized.current = true;
          // Keep default center
        }
      );
    } else {
      hasInitialized.current = true;
    }
  }, [initialLocation]);

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = normalizeCoordinates([pos.coords.latitude, pos.coords.longitude]);
          if (coords) {
            setPosition(coords);
            setMapCenter(coords);
          }
          setIsGettingLocation(false);
        },
        (err) => {
          console.log('Geolocation error:', err);
          setIsGettingLocation(false);
          alert('Unable to get your current location. Please check your browser settings.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } else {
      setIsGettingLocation(false);
      alert('Geolocation is not supported by this browser.');
    }
  };

  // Call the callback only when position changes from user interaction
  // and only if it's actually different from the previous position
  useEffect(() => {
    // Skip if not initialized yet
    if (!hasInitialized.current) return;
    
    // Skip if position hasn't actually changed
    if (coordinatesAreEqual(position, prevPositionRef.current)) return;
    
    // Update previous position
    prevPositionRef.current = position;
    
    // Call the callback
    if (position && onLocationSelect) {
      onLocationSelect({
        lat: position[0],
        lng: position[1]
      });
    }
  }, [position, onLocationSelect]);

  // Update circle overlay when position or radius changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove previous circle if exists
    if (circleOverlay) {
      mapRef.current.removeLayer(circleOverlay);
    }

    if (position && radiusMeters) {
      const newCircle = L.circle(position, {
        radius: radiusMeters,
        color: '#16a34a',
        fillColor: '#16a34a',
        fillOpacity: 0.1
      });
      newCircle.addTo(mapRef.current);
      setCircleOverlay(newCircle);
    }
  }, [position, radiusMeters]);

  return (
    <div className={className}>
      <div className="mb-2 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Click on the map to place a marker or use the pincode lookup. Your radius will be visualized as a green circle.
        </div>
        <Button
          onClick={getCurrentLocation}
          disabled={isGettingLocation}
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
        >
          <Navigation className="h-3 w-3" />
          {isGettingLocation ? 'Getting Location...' : 'Current Location'}
        </Button>
      </div>
      <div className="h-64 w-full border rounded-lg overflow-hidden">
        <MapContainer
          center={mapCenter}
          zoom={13}
          whenCreated={(mapInstance) => {
            mapRef.current = mapInstance;
          }}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker
            position={position}
            setPosition={setPosition}
            initialPosition={initialLocation}
          />
          <MapController mapCenter={mapCenter} />
        </MapContainer>
      </div>
      {position && (
        <div className="mt-2 text-sm text-gray-700">
          Selected coordinates: {position[0].toFixed(6)}, {position[1].toFixed(6)}
        </div>
      )}
    </div>
  );
}

export default MapPicker;