import React, { useState, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
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

const MapBounds: React.FC<{ bounds: Bounds }> = ({ bounds }) => {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      map.fitBounds([
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ], { padding: [50, 50] })
    }
  }, [bounds, map])
  return null
}

export default function RenFaireMap() {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [locationsData, setLocationsData] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  // Load locations from public folder
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
  }, [])

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
      return (
        matchesType &&
        matchesSearch &&
        loc.latitude !== 0 &&
        loc.longitude !== 0
      )
    })
  }, [selectedType, searchTerm, locationsData])

  const types = [
    ...new Set(locationsData.map((loc) => loc.type)),
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
      <div style={styles.header}>
        <h1>🎭 Renaissance Faire Map</h1>
      </div>

      <div style={styles.controls}>
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
            All ({locationsData.length})
          </button>
          {types.map((type) => {
            const count = locationsData.filter((loc) => loc.type === type)
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
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={16}
        style={styles.map}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
          maxZoom={19}
        />
        <MapBounds bounds={bounds} />

        {filteredLocations.map((location) => (
          <Marker
            key={location.id}
            position={[location.latitude, location.longitude]}
            icon={createCustomIcon(getMarkerColor(location.type))}
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
        ))}
      </MapContainer>

      <div style={styles.footer}>
        <p>Tap a marker for details. Use filters to explore specific areas.</p>
      </div>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: '16px',
    backgroundColor: '#2c3e50',
    color: 'white',
    textAlign: 'center' as const,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  controls: {
    padding: '12px',
    backgroundColor: 'white',
    borderBottom: '1px solid #ddd',
    overflowY: 'auto' as const,
    maxHeight: '180px',
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
    border: '1px solid #ddd',
    fontSize: '14px',
    fontFamily: 'inherit',
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
    color: '#999',
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
    border: '1px solid #ccc',
    backgroundColor: '#f0f0f0',
    cursor: 'pointer' as const,
    fontSize: '12px',
    fontWeight: 500 as const,
    color: '#333',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  },
  filterButtonActive: {
    border: '2px solid #333',
    transform: 'scale(1.05)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  },
  resultsInfo: {
    fontSize: '13px',
    color: '#666',
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
    color: '#666',
    backgroundColor: '#fafafa',
    textAlign: 'center' as const,
    borderTop: '1px solid #ddd',
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