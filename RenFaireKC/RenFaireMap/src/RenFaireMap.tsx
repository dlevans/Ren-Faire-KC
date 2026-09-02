import React, { useState, useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle, ImageOverlay } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Location {
  id: string
  name: string
  type: string
  vendortype: string
  latitude: number
  longitude: number
  description: string
  links: string[]
  schedule: string[]
}

interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

// Custom icon colors by type
const getMarkerColor = (type: string): string => {
  const colors: Record<string, string> = {
    FOOD: '#ff6b6b',
    VENDOR: '#4ecdc4',
    ACTIVITY: '#45b7d1',
    STAGE: '#f9ca24',
    GAME: '#6c5ce7',
    BATHROOM: '#a29bfe',
    ATM: '#fd79a8',
    ENTRANCE: '#00b894',
    PIRATE: '#fdcb6e',
    ART: '#e17055',
  }
  return colors[type] || '#95a5a6'
}

const createCustomIcon = (color: string) => {
  return L.divIcon({
    html: `<div style="
      background-color: ${color};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    "></div>`,
    iconSize: [28, 28],
    className: 'custom-marker',
  })
}

const BoundsRectangle: React.FC<{ bounds: Bounds }> = ({ bounds }) => {
  return (
    <Rectangle
      bounds={[
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ]}
      pathOptions={{
        color: '#e74c3c',
        weight: 3,
        opacity: 0.8,
        fillOpacity: 0.05,
      }}
    />
  )
}

const RightClickGPS: React.FC<{ setUserLocation: (loc: [number, number]) => void; setGpsEnabled: (enabled: boolean) => void }> = ({ setUserLocation, setGpsEnabled }) => {
  const map = useMap()
  useEffect(() => {
    const handleRightClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng
      setUserLocation([lat, lng])
      setGpsEnabled(true)
      alert(`GPS position set to: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
    }

    map.on('contextmenu', handleRightClick)
    return () => {
      map.off('contextmenu', handleRightClick)
    }
  }, [map, setUserLocation, setGpsEnabled])
  return null
}

const UserLocationMarker: React.FC<{ location: [number, number] | null; parkingSpot: [number, number] | null }> = ({ location, parkingSpot }) => {
  return (
    <>
      {location && (
        <Marker
          position={location}
          icon={L.divIcon({
            html: `<div style="
              background-color: #3498db;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 0 0 3px #3498db;
            "></div>`,
            iconSize: [20, 20],
            className: 'user-marker',
          })}
        >
          <Popup>You are here</Popup>
        </Marker>
      )}
      {parkingSpot && (
        <Marker
          position={parkingSpot}
          icon={L.divIcon({
            html: `<div style="
              background-color: #e74c3c;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 0 0 3px #e74c3c;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              color: white;
              font-weight: bold;
            ">P</div>`,
            iconSize: [24, 24],
            className: 'parking-marker',
          })}
        >
          <Popup>Parking spot saved</Popup>
        </Marker>
      )}
    </>
  )
}

const MapBounds: React.FC<{ bounds: Bounds }> = ({ bounds }) => {
  const map = useMap()
  const hasInitialized = useRef(false)
  
  useEffect(() => {
    if (bounds && !hasInitialized.current) {
      // Set max bounds to restrict panning
      const maxBounds = L.latLngBounds(
        [bounds.south, bounds.west],
        [bounds.north, bounds.east]
      )
      map.setMaxBounds(maxBounds)
      map.setMinZoom(18)
      
      // Fit map to bounds only on initial load
      map.fitBounds(maxBounds, { padding: [50, 50], animate: false })
      hasInitialized.current = true
    }
  }, [])
  
  // Keep max bounds enforced (runs on every render but doesn't reset view)
  useEffect(() => {
    if (bounds) {
      const maxBounds = L.latLngBounds(
        [bounds.south, bounds.west],
        [bounds.north, bounds.east]
      )
      map.setMaxBounds(maxBounds)
    }
  }, [bounds, map])
  
  return null
}

export default function RenFaireMap() {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [locationsData, setLocationsData] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [parkingSpot, setParkingSpot] = useState<[number, number] | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [hideMarkers, setHideMarkers] = useState(false)
  const [hideUI, setHideUI] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState<'fairy' | 'pirate' | 'viking' | null>('pirate')

  // Load locations from public folder and restore parking spot
  useEffect(() => {
    fetch('/locations.json')
      .then(res => res.json())
      .then(data => {
        setLocationsData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load locations:', err)
        setLoading(false)
      })

    // Load saved parking spot
    const savedParking = localStorage.getItem('parkingSpot')
    if (savedParking) {
      const [lat, lng] = JSON.parse(savedParking)
      setParkingSpot([lat, lng])
    }
  }, [])

  // Request GPS permission and track location
  const requestGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation([latitude, longitude])
        setGpsEnabled(true)
      },
      (error) => {
        alert(`GPS error: ${error.message}`)
        console.error('GPS error:', error)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )

    // Watch position for continuous updates
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation([latitude, longitude])
      },
      (error) => console.error('GPS watch error:', error),
      { enableHighAccuracy: true }
    )

    return watchId
  }

  // Calculate distance between two coordinates in feet
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 20902231 // Earth radius in feet
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Save current location as parking spot
  const saveParkingSpot = () => {
    if (!userLocation) {
      alert('GPS location not available yet')
      return
    }
    setParkingSpot(userLocation)
    localStorage.setItem('parkingSpot', JSON.stringify(userLocation))
    alert('Parking spot saved!')
  }

  // Clear parking spot
  const clearParkingSpot = () => {
    setParkingSpot(null)
    localStorage.removeItem('parkingSpot')
  }

  // Get distance to selected location
  const getDistanceToSelected = (): number | null => {
    if (!userLocation || !selectedLocationId) return null
    const location = locationsData.find(loc => loc.id === selectedLocationId)
    if (!location) return null
    return calculateDistance(userLocation[0], userLocation[1], location.latitude, location.longitude)
  }

  const bounds: Bounds = {
    north: 39.115053,
    south: 39.108306,
    east: -94.870419,
    west: -94.879036,
  }

  // Filter locations
  const filteredLocations = useMemo(() => {
    return locationsData.filter((loc) => {
      const matchesType = !selectedType || loc.type === selectedType
      const matchesSearch =
        !searchTerm ||
        loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.vendortype.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.description.toLowerCase().includes(searchTerm.toLowerCase())
      // Check if location is within bounding box
      const isWithinBounds =
        loc.latitude >= bounds.south &&
        loc.latitude <= bounds.north &&
        loc.longitude >= bounds.west &&
        loc.longitude <= bounds.east
      return (
        matchesType &&
        matchesSearch &&
        isWithinBounds &&
        loc.latitude !== 0 &&
        loc.longitude !== 0
      )
    })
  }, [selectedType, searchTerm, locationsData, bounds])

  // Get locations within bounds for filter display
  const locationsInBounds = useMemo(() => {
    return locationsData.filter(
      (loc) =>
        loc.latitude >= bounds.south &&
        loc.latitude <= bounds.north &&
        loc.longitude >= bounds.west &&
        loc.longitude <= bounds.east &&
        loc.latitude !== 0 &&
        loc.longitude !== 0
    )
  }, [locationsData, bounds])

  const types = [
    ...new Set(locationsInBounds.map((loc) => loc.type)),
  ].sort()

  const center: [number, number] = [
    (bounds.north + bounds.south) / 2,
    (bounds.east + bounds.west) / 2,
  ]

  if (loading) {
    return <div style={styles.loading}>Loading map...</div>
  }

  return (
    <div style={styles.container}>
      {!hideUI && (
        <div style={styles.header}>
          <h1>Ren Faire Map Kansas City</h1>
        </div>
      )}

      {!hideUI && (
      <div style={styles.controls}>
        <div style={styles.gpsControls}>
          <button
            onClick={requestGPS}
            style={{
              ...styles.gpsButton,
              backgroundColor: gpsEnabled ? '#27ae60' : '#3498db',
            }}
          >
            {gpsEnabled ? '📍 GPS Active' : '📍 Enable GPS'}
          </button>
          {userLocation && (
            <>
              <button
                onClick={saveParkingSpot}
                style={styles.parkingButton}
                title="Save current location as parking spot"
              >
                {parkingSpot ? '🅿️ Update Parking' : '🅿️ Save Parking'}
              </button>
              {parkingSpot && (
                <button
                  onClick={clearParkingSpot}
                  style={styles.clearParkingButton}
                  title="Clear saved parking spot"
                >
                  ✕ Parking
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setHideMarkers(!hideMarkers)}
            style={{
              ...styles.screenshotButton,
              backgroundColor: hideMarkers ? '#9b59b6' : '#95a5a6',
            }}
            title="Hide booth markers for clean screenshots"
          >
            {hideMarkers ? '👁️ Markers hidden' : '📸 Hide POIs'}
          </button>
          <button
            onClick={() => setHideUI(!hideUI)}
            style={{
              ...styles.screenshotButton,
              backgroundColor: hideUI ? '#9b59b6' : '#95a5a6',
            }}
            title="Hide entire UI for full-screen screenshots"
          >
            {hideUI ? '👁️ UI hidden' : '🎬 Hide UI'}
          </button>
        </div>

        <div style={styles.themeSelector}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd', marginRight: '8px' }}>Theme:</span>
          <button
            onClick={() => setSelectedTheme(null)}
            style={{
              ...styles.filterButton,
              backgroundColor: selectedTheme === null ? '#3498db' : '#2a2a2a',
              color: selectedTheme === null ? 'white' : '#ddd',
              fontWeight: selectedTheme === null ? 600 : 500,
            }}
          >
            Base Map
          </button>
          <button
            onClick={() => setSelectedTheme('fairy')}
            style={{
              ...styles.filterButton,
              backgroundColor: selectedTheme === 'fairy' ? '#e74c3c' : '#2a2a2a',
              color: selectedTheme === 'fairy' ? 'white' : '#ddd',
              fontWeight: selectedTheme === 'fairy' ? 600 : 500,
            }}
          >
            ✨ Fairy
          </button>
          <button
            onClick={() => setSelectedTheme('pirate')}
            style={{
              ...styles.filterButton,
              backgroundColor: selectedTheme === 'pirate' ? '#34495e' : '#2a2a2a',
              color: selectedTheme === 'pirate' ? 'white' : '#ddd',
              fontWeight: selectedTheme === 'pirate' ? 600 : 500,
            }}
          >
            🏴‍☠️ Pirate
          </button>
          <button
            onClick={() => setSelectedTheme('viking')}
            style={{
              ...styles.filterButton,
              backgroundColor: selectedTheme === 'viking' ? '#8B4513' : '#2a2a2a',
              color: selectedTheme === 'viking' ? 'white' : '#ddd',
              fontWeight: selectedTheme === 'viking' ? 600 : 500,
            }}
          >
            ⚔️ Viking
          </button>
        </div>

        <div style={styles.searchBox}>
          <input
            type="text"
            placeholder="Search vendors, activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={styles.clearButton}
            >
              ✕
            </button>
          )}
        </div>

        <div style={styles.filterContainer}>
          <button
            style={{
              ...styles.filterButton,
              ...(selectedType === null && styles.filterButtonActive),
            }}
            onClick={() => setSelectedType(null)}
          >
            All ({locationsInBounds.length})
          </button>
          {types.map((type) => {
            const count = locationsInBounds.filter((loc) => loc.type === type)
              .length
            return (
              <button
                key={type}
                style={{
                  ...styles.filterButton,
                  backgroundColor: getMarkerColor(type),
                  ...(selectedType === type && styles.filterButtonActive),
                }}
                onClick={() => setSelectedType(type)}
                title={type}
              >
                {type} ({count})
              </button>
            )
          })}
        </div>

        <div style={styles.resultsInfo}>
          Found {filteredLocations.length} location
          {filteredLocations.length !== 1 ? 's' : ''}
          {userLocation && selectedLocationId && (
            <div style={{ marginTop: '8px', color: '#e74c3c', fontWeight: 'bold' }}>
              📍 {selectedLocationId && locationsData.find(l => l.id === selectedLocationId)?.name}: {Math.round(getDistanceToSelected() || 0)} ft away
            </div>
          )}
        </div>
      </div>
      )}

      <MapContainer
        center={center}
        zoom={18}
        style={styles.map}
        scrollWheelZoom={true}
        maxZoom={19}
      >
        {selectedTheme === null && (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
            maxZoom={19}
          />
        )}
        <MapBounds bounds={bounds} />
        <RightClickGPS setUserLocation={setUserLocation} setGpsEnabled={setGpsEnabled} />
        {!hideMarkers && <UserLocationMarker location={userLocation} parkingSpot={parkingSpot} />}

        {selectedTheme === 'fairy' && (
          <ImageOverlay
            url="/images/map1.png"
            bounds={[[39.108306, -94.879036], [39.115053, -94.870419]]}
            opacity={0.75}
          />
        )}
        {selectedTheme === 'pirate' && (
          <ImageOverlay
            url="/images/map2.png"
            bounds={[[39.108306, -94.879036], [39.115053, -94.870419]]}
            opacity={0.75}
          />
        )}
        {selectedTheme === 'viking' && (
          <ImageOverlay
            url="/images/map3.png"
            bounds={[[39.108306, -94.879036], [39.115053, -94.870419]]}
            opacity={0.75}
          />
        )}

        {!hideMarkers && filteredLocations.map((location) => {
          const distance = userLocation ? calculateDistance(userLocation[0], userLocation[1], location.latitude, location.longitude) : null
          return (
            <Marker
              key={location.id}
              position={[location.latitude, location.longitude]}
              icon={createCustomIcon(selectedLocationId === location.id ? '#2c3e50' : getMarkerColor(location.type))}
              eventHandlers={{
                click: () => setSelectedLocationId(location.id),
              }}
            >
              <Popup>
                <div style={styles.popupContent}>
                  <h3 style={styles.popupTitle}>{location.name}</h3>
                  <p style={styles.popupDetail}>
                    <strong>Type:</strong> {location.type}
                  </p>
                  <p style={styles.popupDetail}>
                    <strong>Category:</strong> {location.vendortype}
                  </p>
                  {distance && (
                    <p style={{ ...styles.popupDetail, color: '#e74c3c', fontWeight: 'bold' }}>
                      📍 {Math.round(distance)} ft away
                    </p>
                  )}
                  {location.description && (
                    <p style={styles.popupDetail}>
                      <strong>Details:</strong> {location.description}
                    </p>
                  )}
                  {location.links && location.links[0] && (
                    <p style={styles.popupDetail}>
                      <a
                        href={location.links[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.link}
                      >
                        Visit Website →
                      </a>
                    </p>
                  )}
                  {location.schedule && location.schedule[0] && (
                    <p style={styles.popupDetail}>
                      <strong>Schedule:</strong> {location.schedule[0]}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {!hideUI && (
        <div style={styles.footer}>
          <p>Tap a marker for details. Use filters to explore specific areas. <em>(Right-click to test GPS position)</em></p>
        </div>
      )}
    </div>
  )
}

const styles = {
  loading: {
    display: 'flex' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    height: '100vh',
    fontSize: '18px',
    color: '#666',
  },
  container: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#000000',
  },
  header: {
    padding: '16px',
    backgroundColor: '#0f0f0f',
    color: 'white',
    textAlign: 'center' as const,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  controls: {
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #333',
    overflowY: 'auto' as const,
    maxHeight: '220px',
  },
  gpsControls: {
    display: 'flex' as const,
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap' as const,
  },
  gpsButton: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#3498db',
    color: 'white',
    cursor: 'pointer' as const,
    fontSize: '13px',
    fontWeight: 600 as const,
    transition: 'all 0.2s',
  },
  parkingButton: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#f39c12',
    color: 'white',
    cursor: 'pointer' as const,
    fontSize: '13px',
    fontWeight: 600 as const,
    transition: 'all 0.2s',
  },
  clearParkingButton: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #e74c3c',
    backgroundColor: 'white',
    color: '#e74c3c',
    cursor: 'pointer' as const,
    fontSize: '13px',
    fontWeight: 600 as const,
    transition: 'all 0.2s',
  },
  screenshotButton: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: 'none',
    color: 'white',
    cursor: 'pointer' as const,
    fontSize: '13px',
    fontWeight: 600 as const,
    transition: 'all 0.2s',
  },
  themeSelector: {
    display: 'flex' as const,
    gap: '8px',
    marginBottom: '8px',
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
  },
  searchBox: {
    marginBottom: '12px',
    position: 'relative' as const,
    display: 'flex' as const,
  },
  searchInput: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #444',
    fontSize: '14px',
    fontFamily: 'inherit',
    backgroundColor: '#2a2a2a',
    color: '#fff',
  },
  clearButton: {
    position: 'absolute' as const,
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer' as const,
    fontSize: '18px',
    color: '#666',
    padding: '0 8px',
  },
  filterContainer: {
    display: 'flex' as const,
    flexWrap: 'wrap' as const,
    gap: '6px',
    marginBottom: '8px',
  },
  filterButton: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #555',
    backgroundColor: '#2a2a2a',
    cursor: 'pointer' as const,
    fontSize: '12px',
    fontWeight: 500 as const,
    color: '#ddd',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  },
  filterButtonActive: {
    border: '2px solid #fff',
    transform: 'scale(1.05)',
    boxShadow: '0 2px 6px rgba(255,255,255,0.15)',
  },
  resultsInfo: {
    fontSize: '13px',
    color: '#aaa',
    marginTop: '4px',
  },
  map: {
    flex: 1,
    width: '100%',
    zIndex: 1,
  },
  footer: {
    padding: '8px 12px',
    fontSize: '12px',
    color: '#000',
    backgroundColor: '#1a1a1a',
    textAlign: 'center' as const,
    borderTop: '1px solid #333',
  },
  popupContent: {
    fontSize: '13px',
    color: '#333',
  },
  popupTitle: {
    margin: '0 0 8px 0',
    fontSize: '15px',
    fontWeight: 600 as const,
    color: '#2c3e50',
  },
  popupDetail: {
    margin: '4px 0',
    lineHeight: 1.4,
  },
  link: {
    color: '#0066cc',
    textDecoration: 'none',
    fontWeight: 500 as const,
  },
}