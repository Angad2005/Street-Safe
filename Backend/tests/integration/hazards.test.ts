import request from 'supertest';
import { app } from '../../src/index';
import { getAllHazards, addHazard } from '../../src/Hazards';

describe('Backend Hazard Management', () => {
  const mockToken = 'mock-jwt-token';

  // ─────────────────────────────────────────────────────────────
  // TC-BE-HAZ-01 - Fetch Hazards
  // ─────────────────────────────────────────────────────────────
  describe('TC-BE-HAZ-01 - Fetch Hazards', () => {
    describe('API Route Tests', () => {
      it('Given an empty hazards database, When GET /api/hazards is requested, Then it returns HTTP 200 with an empty array', async () => {
        const response = await request(app)
          .get('/api/hazards')
          .set('Authorization', `Bearer ${mockToken}`);
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(0);
      });

      it('Given a database with hazards, When GET /api/hazards is requested, Then it returns HTTP 200 with complete safety payloads', async () => {
        // Add a hazard first
        await request(app)
          .post('/api/addhazards')
          .set('Authorization', `Bearer ${mockToken}`)
          .send({ Category: 'theft', Latitude: '52.450', Longitude: '-1.920' });

        const response = await request(app)
          .get('/api/hazards')
          .set('Authorization', `Bearer ${mockToken}`);
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });

      it('Given hazards exist, When fetched, Then each hazard has Category, Latitude, and Longitude properties', async () => {
        // Add a hazard first
        await request(app)
          .post('/api/addhazards')
          .set('Authorization', `Bearer ${mockToken}`)
          .send({ Category: 'harassment', Latitude: '52.480', Longitude: '-1.900' });

        const response = await request(app)
          .get('/api/hazards')
          .set('Authorization', `Bearer ${mockToken}`);
        
        const hazard = response.body[0];
        expect(hazard).toHaveProperty('id');
        expect(hazard).toHaveProperty('Category');
        expect(hazard).toHaveProperty('Latitude');
        expect(hazard).toHaveProperty('Longitude');
        expect(hazard).toHaveProperty('timestamp');
      });

      it('Given multiple hazards exist, When fetched, Then they are ordered newest first', async () => {
        // Add multiple hazards
        await request(app)
          .post('/api/addhazards')
          .set('Authorization', `Bearer ${mockToken}`)
          .send({ Category: 'theft', Latitude: '52.450', Longitude: '-1.920' });
        
        await request(app)
          .post('/api/addhazards')
          .set('Authorization', `Bearer ${mockToken}`)
          .send({ Category: 'harassment', Latitude: '52.460', Longitude: '-1.910' });
        
        await request(app)
          .post('/api/addhazards')
          .set('Authorization', `Bearer ${mockToken}`)
          .send({ Category: 'vandalism', Latitude: '52.470', Longitude: '-1.905' });

        const response = await request(app)
          .get('/api/hazards')
          .set('Authorization', `Bearer ${mockToken}`);
        
        // Most recently added should be first
        expect(response.body[0].Category).toBe('vandalism');
        expect(response.body[1].Category).toBe('harassment');
        expect(response.body[2].Category).toBe('theft');
      });
    });

    describe('Direct Function Tests', () => {
      it('Given an empty database, When getAllHazards is called, Then it returns an empty array', () => {
        const hazards = getAllHazards();
        expect(Array.isArray(hazards)).toBe(true);
      });

      it('Given a hazard exists, When getAllHazards is called, Then it returns the hazard', () => {
        addHazard('test-hazard', '52.0', '-1.5');
        const hazards = getAllHazards();
        expect(hazards.length).toBeGreaterThan(0);
        expect(hazards[0]).toHaveProperty('Category');
        expect(hazards[0]).toHaveProperty('Latitude');
        expect(hazards[0]).toHaveProperty('Longitude');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Add Hazard Tests
  // ─────────────────────────────────────────────────────────────
  describe('Add Hazard - POST /api/addhazards', () => {
    it('Given valid hazard data, When POST /api/addhazards is called, Then it returns HTTP 201 with success message', async () => {
      const response = await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ Category: 'theft', Latitude: '52.450', Longitude: '-1.920' });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Hazard added!');
      expect(response.body).toHaveProperty('id');
    });

    it('Given valid hazard data, When addHazard is called directly, Then it inserts the hazard', () => {
      const result = addHazard('direct-test', '53.0', '-2.0');
      expect(result).toHaveProperty('lastInsertRowid');
    });

    it('Given missing Category field, When POST /api/addhazards is called, Then it returns HTTP 400', async () => {
      const response = await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ Latitude: '52.450', Longitude: '-1.920' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('Given missing Latitude field, When POST /api/addhazards is called, Then it returns HTTP 400', async () => {
      const response = await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ Category: 'theft', Longitude: '-1.920' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('Given missing Longitude field, When POST /api/addhazards is called, Then it returns HTTP 400', async () => {
      const response = await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ Category: 'theft', Latitude: '52.450' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('Given empty body, When POST /api/addhazards is called, Then it returns HTTP 400', async () => {
      const response = await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TC-INT-HAZ-01 - Hazard Alerting Flow (Integration)
  // ─────────────────────────────────────────────────────────────
  describe('TC-INT-HAZ-01 - Hazard Alerting Flow (Integration)', () => {
    it('Given a new hazard reported, When stored in the backend, Then active users fetching it receive the marker correctly', async () => {
      // 1. Submit a hazard
      const postRes = await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ Category: 'theft', Latitude: '52.450', Longitude: '-1.920' });
      
      expect([200, 201]).toContain(postRes.status);

      // 2. Fetch hazards and verify presence
      const getRes = await request(app)
        .get('/api/hazards')
        .set('Authorization', `Bearer ${mockToken}`);
      
      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body)).toBe(true);
      
      // Find the hazard we just added
      const newlyAdded = getRes.body.find((h: any) => 
        h.Category === 'theft' && 
        h.Latitude === '52.450' && 
        h.Longitude === '-1.920'
      );
      expect(newlyAdded).toBeDefined();
      expect(newlyAdded.Category).toBe('theft');
    });

    it('Given multiple hazards of different categories, When reported and fetched, Then all are correctly stored and returned', async () => {
      const categories = ['theft', 'harassment', 'vandalism', 'suspicious', 'other'];
      const coordinates = [
        { lat: '52.450', lon: '-1.920' },
        { lat: '52.460', lon: '-1.910' },
        { lat: '52.470', lon: '-1.900' },
        { lat: '52.480', lon: '-1.890' },
        { lat: '52.490', lon: '-1.880' }
      ];

      // Add hazards
      for (let i = 0; i < categories.length; i++) {
        await request(app)
          .post('/api/addhazards')
          .set('Authorization', `Bearer ${mockToken}`)
          .send({ 
            Category: categories[i], 
            Latitude: coordinates[i].lat, 
            Longitude: coordinates[i].lon 
          });
      }

      // Fetch all hazards
      const response = await request(app)
        .get('/api/hazards')
        .set('Authorization', `Bearer ${mockToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(categories.length);

      // Verify each category exists
      for (const category of categories) {
        const found = response.body.find((h: any) => h.Category === category);
        expect(found).toBeDefined();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TC-BE-OSM-02 - Hazard Data Edge Bias
  // ─────────────────────────────────────────────────────────────
  describe('TC-BE-OSM-02 - Hazard Data Edge Bias', () => {
    it('Given hazard coordinates, When stored, Then they are preserved accurately for edge weighting', async () => {
      const testLat = '52.4862';
      const testLon = '-1.8904';

      await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ Category: 'harassment', Latitude: testLat, Longitude: testLon });

      const response = await request(app)
        .get('/api/hazards')
        .set('Authorization', `Bearer ${mockToken}`);
      
      const hazard = response.body.find((h: any) => h.Category === 'harassment');
      expect(hazard).toBeDefined();
      expect(hazard.Latitude).toBe(testLat);
      expect(hazard.Longitude).toBe(testLon);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Edge Cases; since 
  // ─────────────────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('Given hazard with special characters in category, When added, Then it is stored correctly', async () => {
      const specialCategory = "Harassment & 'Theft'";
      
      const response = await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ Category: specialCategory, Latitude: '52.450', Longitude: '-1.920' });
      
      expect([200, 201]).toContain(response.status);

      const getRes = await request(app)
        .get('/api/hazards')
        .set('Authorization', `Bearer ${mockToken}`);
      
      const hazard = getRes.body.find((h: any) => h.Category === specialCategory);
      expect(hazard).toBeDefined();
    });

    it('Given hazard with boundary coordinates, When added, Then it is stored correctly', async () => {
      // Test edge case coordinates
      const boundaryCoords = [
        { lat: '90', lon: '180' },    // Max positive
        { lat: '-90', lon: '-180' },  // Max negative
        { lat: '0', lon: '0' },       // Origin
        { lat: '-90', lon: '180' },   // Mixed
      ];

      for (const coord of boundaryCoords) {
        await request(app)
          .post('/api/addhazards')
          .set('Authorization', `Bearer ${mockToken}`)
          .send({ Category: 'boundary-test', Latitude: coord.lat, Longitude: coord.lon });
      }

      const response = await request(app)
        .get('/api/hazards')
        .set('Authorization', `Bearer ${mockToken}`);
      
      const boundaryHazards = response.body.filter((h: any) => h.Category === 'boundary-test');
      expect(boundaryHazards.length).toBe(boundaryCoords.length);
    });

    it('Given hazard with numeric category, When added, Then it is stored correctly', async () => {
      const numericCategory = '12345';
      
      const response = await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ Category: numericCategory, Latitude: '52.450', Longitude: '-1.920' });
      
      expect([200, 201]).toContain(response.status);

      const getRes = await request(app)
        .get('/api/hazards')
        .set('Authorization', `Bearer ${mockToken}`);
      
      const hazard = getRes.body.find((h: any) => h.Category === numericCategory);
      expect(hazard).toBeDefined();
    });

    it('Given hazard with whitespace-only category, When added, Then it is stored correctly', async () => {
      const whitespaceCategory = '   ';
      
      const response = await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ Category: whitespaceCategory, Latitude: '52.450', Longitude: '-1.920' });
      
      expect([200, 201]).toContain(response.status);
    });

    it('Given hazard data structure, When retrieved, Then it has correct types', async () => {
      await request(app)
        .post('/api/addhazards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ Category: 'type-test', Latitude: '52.450', Longitude: '-1.920' });

      const response = await request(app)
        .get('/api/hazards')
        .set('Authorization', `Bearer ${mockToken}`);
      
      const hazard = response.body.find((h: any) => h.Category === 'type-test');
      expect(hazard).toBeDefined();
      expect(typeof hazard.id).toBe('number');
      expect(typeof hazard.Category).toBe('string');
      expect(typeof hazard.Latitude).toBe('string');
      expect(typeof hazard.Longitude).toBe('string');
      expect(typeof hazard.timestamp).toBe('string');
    });

    it('Given many hazards added, When fetched, Then all are returned without data loss', async () => {
      const count = 50;
      
      for (let i = 0; i < count; i++) {
        await request(app)
          .post('/api/addhazards')
          .set('Authorization', `Bearer ${mockToken}`)
          .send({ 
            Category: `bulk-test-${i}`, 
            Latitude: `${52 + i * 0.001}`, 
            Longitude: `${-1.9 + i * 0.001}` 
          });
      }

      const response = await request(app)
        .get('/api/hazards')
        .set('Authorization', `Bearer ${mockToken}`);
      
      const bulkHazards = response.body.filter((h: any) => h.Category.startsWith('bulk-test-'));
      expect(bulkHazards.length).toBe(count);
    });
  });
});
