
import { FloodIncident, HotspotZone, NewReportPayload } from '../types';
import { INITIAL_INCIDENTS, HISTORIC_HOTSPOTS } from '../data/sampleIncidents';
import { calculateTrustScore } from '../utils/trustScore';

const STORAGE_KEY = 'floodlens_incidents_v2';
const VOTED_KEY = 'floodlens_voted_incidents_v1';

export const AWS_API_BASE_URL =
  import.meta.env.VITE_AWS_API_BASE_URL || '';

export const IS_AWS_CONNECTED = Boolean(
  AWS_API_BASE_URL && AWS_API_BASE_URL.startsWith('http')
);

class IncidentService {
  public getCorroboratedIncidentIds(): string[] {
    try {
      const data = localStorage.getItem(VOTED_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore invalid stored data.
    }
    return [];
  }

  public hasCorroborated(incidentId: string): boolean {
    return this.getCorroboratedIncidentIds().includes(incidentId);
  }

  private markCorroborated(incidentId: string): void {
    const voted = this.getCorroboratedIncidentIds();

    if (!voted.includes(incidentId)) {
      voted.push(incidentId);
      localStorage.setItem(VOTED_KEY, JSON.stringify(voted));
    }
  }

  private normalizePhotoUrl(url?: string): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('data:image/')) return url;

    if (url.includes('mumbai_underpass_flood_1791545823927')) {
      return '/images/mumbai_underpass_flood_1791545823927.jpg';
    }

    if (url.includes('bengaluru_ringroad_flood_1791545845927')) {
      return '/images/bengaluru_ringroad_flood_1791545845927.jpg';
    }

    if (url.includes('drainage_pump_inspection_1791545867557')) {
      return '/images/drainage_pump_inspection_1791545867557.jpg';
    }

    return url;
  }

  private normalizeApiIncident(raw: any): FloodIncident {
    const item = raw?.payload
      ? { ...raw.payload, ...raw }
      : raw ?? {};

    const timestamp = Number(item.timestamp) || Date.now();

    const severity: FloodIncident['severity'] =
      ['high', 'moderate', 'low'].includes(item.severity)
        ? item.severity
        : 'moderate';

    const roadTypes = [
      'underpass',
      'arterial',
      'junction',
      'residential',
      'highway',
    ];

    const roadType: FloodIncident['roadType'] =
      roadTypes.includes(item.roadType)
        ? item.roadType
        : 'residential';

    const statuses = [
      'active',
      'receding',
      'cleared',
      'under_inspection',
    ];

    const status: FloodIncident['status'] =
      statuses.includes(item.status) ? item.status : 'active';

    const roles = [
      'Citizen Commuter',
      'Traffic Warden',
      'Flood Volunteer',
      'Municipal Field Officer',
    ];

    const rawRole = item.reportedBy?.role ?? item.reporterRole;

    const reporterRole: FloodIncident['reportedBy']['role'] =
      roles.includes(rawRole) ? rawRole : 'Citizen Commuter';

    const coordinates: [number, number] =
      Array.isArray(item.coordinates) &&
      item.coordinates.length >= 2 &&
      Number.isFinite(Number(item.coordinates[0])) &&
      Number.isFinite(Number(item.coordinates[1]))
        ? [Number(item.coordinates[0]), Number(item.coordinates[1])]
        : [0, 0];

    const waterDepthCm = Math.max(0, Number(item.waterDepthCm) || 0);
    const corroborationCount = Math.max(
      0,
      Number(item.corroborationCount) || 0
    );

    const photoUrl = this.normalizePhotoUrl(item.photoUrl);

    const trustScore =
      item.trustScore &&
      typeof item.trustScore.score === 'number' &&
      typeof item.trustScore.confidenceLevel === 'string' &&
      Array.isArray(item.trustScore.reasoningFactors)
        ? item.trustScore
        : calculateTrustScore({
            reportedTimestamp: timestamp,
            corroborationCount,
            hasPhoto: Boolean(photoUrl),
            reporterRole,
            waterDepthCm,
            severity,
          });

    return {
      id: String(item.id ?? `fl-api-${timestamp}`),
      title: String(item.title ?? 'Flood report'),
      locationName: String(
        item.locationName ?? item.landmark ?? 'Reported location'
      ),
      landmark: String(item.landmark ?? 'Not provided'),
      wardOrDistrict: String(item.wardOrDistrict ?? 'Not provided'),
      city: String(item.city ?? 'Hyderabad') as FloodIncident['city'],
      coordinates,
      severity,
      waterDepthCm,
      reportedAt: String(
        item.reportedAt ?? new Date(timestamp).toLocaleString()
      ),
      timestamp,
      description: String(
        item.description ?? 'No description provided.'
      ),
      roadType,
      status,
      photoUrl,
      corroborationCount,
      corroborationIds: Array.isArray(item.corroborationIds)
        ? item.corroborationIds
        : [],
      reportedBy: {
        name: String(
          item.reportedBy?.name ??
            item.reporterName ??
            'Anonymous Citizen'
        ),
        role: reporterRole,
        isVerifiedBadge: Boolean(
          item.reportedBy?.isVerifiedBadge
        ),
      },
      trustScore,
      authorityAction: item.authorityAction,
      isSampleData: Boolean(item.isSampleData),
    };
  }

  private getStoredIncidents(): FloodIncident[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);

      if (data) {
        const parsed = JSON.parse(data);

        if (Array.isArray(parsed)) {
          return parsed.map((incident) => ({
            ...incident,
            photoUrl: this.normalizePhotoUrl(incident.photoUrl),
          }));
        }
      }
    } catch {
      // Recover using the demo dataset.
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_INCIDENTS));
    return INITIAL_INCIDENTS;
  }

  private saveIncidents(incidents: FloodIncident[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
    } catch (error) {
      console.error('Failed to save incidents locally:', error);
    }
  }

  public async getIncidents(): Promise<FloodIncident[]> {
    if (IS_AWS_CONNECTED) {
      try {
        const response = await fetch(
          `${AWS_API_BASE_URL}/api/v1/incidents`
        );

        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error('Incident API response must be an array.');
        }

        return data.map((item) => this.normalizeApiIncident(item));
      } catch (error) {
        console.warn(
          'Incident API unavailable; using local demo data:',
          error
        );
      }
    }

    return this.getStoredIncidents().map((incident) => ({
      ...incident,
      trustScore: calculateTrustScore({
        reportedTimestamp: incident.timestamp,
        corroborationCount: incident.corroborationCount,
        hasPhoto: Boolean(incident.photoUrl),
        reporterRole: incident.reportedBy.role,
        waterDepthCm: incident.waterDepthCm,
        severity: incident.severity,
      }),
    }));
  }

  public getHotspots(): Promise<HotspotZone[]> {
    return Promise.resolve(HISTORIC_HOTSPOTS);
  }

  public async submitReport(
    payload: NewReportPayload
  ): Promise<FloodIncident> {
    if (IS_AWS_CONNECTED) {
      try {
        const response = await fetch(
          `${AWS_API_BASE_URL}/api/v1/reports`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const liveIncident = await response.json();
        const normalized = this.normalizeApiIncident(liveIncident);

        const existing = this.getStoredIncidents();

        this.saveIncidents([
          normalized,
          ...existing.filter((item) => item.id !== normalized.id),
        ]);

        return normalized;
      } catch (error) {
        console.warn(
          'Report API unavailable; saving locally instead:',
          error
        );
      }
    }

    const timestamp = Date.now();
    const existing = this.getStoredIncidents();

    const nearbyReports = existing.filter((incident) => {
      const dLat = Math.abs(
        incident.coordinates[0] - payload.coordinates[0]
      );
      const dLng = Math.abs(
        incident.coordinates[1] - payload.coordinates[1]
      );

      return (
        dLat < 0.006 &&
        dLng < 0.006 &&
        incident.city === payload.city
      );
    });

    const initialCorroboration = nearbyReports.length;

    const trustScore = calculateTrustScore({
      reportedTimestamp: timestamp,
      corroborationCount: initialCorroboration,
      hasPhoto: Boolean(payload.photoUrl),
      reporterRole: payload.reporterRole,
      waterDepthCm: payload.waterDepthCm,
      severity: payload.severity,
    });

    const newIncident: FloodIncident = {
      id: `fl-rep-${timestamp.toString(36)}`,
      title: payload.title,
      locationName: payload.locationName,
      landmark: payload.landmark,
      wardOrDistrict: payload.wardOrDistrict,
      city: payload.city,
      coordinates: payload.coordinates,
      severity: payload.severity,
      waterDepthCm: payload.waterDepthCm,
      reportedAt: 'Just now',
      timestamp,
      description: payload.description,
      roadType: payload.roadType,
      status: 'active',
      photoUrl: payload.photoUrl,
      corroborationCount: initialCorroboration,
      corroborationIds: nearbyReports.map((item) => item.id),
      reportedBy: {
        name: payload.reporterName || 'Anonymous Citizen',
        role: payload.reporterRole,
        isVerifiedBadge: payload.reporterRole !== 'Citizen Commuter',
      },
      trustScore,
      isSampleData: false,
    };

    this.saveIncidents([newIncident, ...existing]);
    return newIncident;
  }

  public async corroborateIncident(
    incidentId: string
  ): Promise<FloodIncident> {
    // First look for the incident in browser storage.
    let existing = this.getStoredIncidents();
    let index = existing.findIndex((item) => item.id === incidentId);

    // API incidents may not exist in localStorage.
    if (index === -1 && IS_AWS_CONNECTED) {
      const apiIncidents = await this.getIncidents();
      const apiIncident = apiIncidents.find(
        (item) => item.id === incidentId
      );

      if (apiIncident) {
        existing = [
          apiIncident,
          ...existing.filter((item) => item.id !== incidentId),
        ];
        index = 0;
      }
    }

    if (index === -1) {
      throw new Error(`Incident ${incidentId} was not found.`);
    }

    const incident = existing[index];

    if (this.hasCorroborated(incidentId)) {
      return incident;
    }

    const newCount = incident.corroborationCount + 1;
    const currentIds = Array.isArray(incident.corroborationIds)
      ? [...incident.corroborationIds]
      : [];

    const updated: FloodIncident = {
      ...incident,
      corroborationCount: newCount,
      corroborationIds: [
        ...currentIds,
        `voter_${Date.now().toString(36)}`,
      ],
      trustScore: calculateTrustScore({
        reportedTimestamp: incident.timestamp,
        corroborationCount: newCount,
        hasPhoto: Boolean(incident.photoUrl),
        reporterRole: incident.reportedBy.role,
        waterDepthCm: incident.waterDepthCm,
        severity: incident.severity,
      }),
    };

    existing[index] = updated;
    this.saveIncidents(existing);
    this.markCorroborated(incidentId);

    return updated;
  }

  public async updateAuthorityAction(
    incidentId: string,
    actionType:
      | 'Pump Dispatched'
      | 'Traffic Diversion'
      | 'Inspection Scheduled'
      | 'Barricade Erected'
      | 'Drain Cleared',
    notes: string,
    authorityName: string
  ): Promise<FloodIncident> {
    const existing = this.getStoredIncidents();
    const index = existing.findIndex((item) => item.id === incidentId);

    if (index === -1) {
      throw new Error('Incident not found in local storage.');
    }

    const incident = existing[index];
    let newStatus = incident.status;

    if (actionType === 'Drain Cleared') {
      newStatus = 'cleared';
    } else if (
      actionType === 'Pump Dispatched' ||
      actionType === 'Traffic Diversion'
    ) {
      newStatus = 'under_inspection';
    }

    const updated: FloodIncident = {
      ...incident,
      status: newStatus,
      authorityAction: {
        actionType,
        updatedAt: 'Just now',
        authorityName,
        notes,
      },
    };

    existing[index] = updated;
    this.saveIncidents(existing);

    return updated;
  }

  public resetToSampleData(): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(INITIAL_INCIDENTS)
    );
  }
}

export const incidentService = new IncidentService();
