// ---------------------------------------------------------------------------
// spot-api.js — Spot & Related Data Access Service
// ---------------------------------------------------------------------------
// Every read / write touching the `spots`, `reviews`, `saved_spots`, and
// `itineraries` tables flows through this class so the UI layer never
// constructs Supabase queries directly.
//
// Exports (default):
//   SpotApi
// ---------------------------------------------------------------------------

/**
 * Data-access layer for spots and related entities (reviews, saved spots,
 * itineraries).
 *
 * **Dependency:** A Supabase client instance (injected via constructor).
 */
export default class SpotApi {
  /**
   * @param {object} supabaseClient - A pre-configured Supabase client.
   */
  constructor(supabaseClient) {
    /** @private */
    this._supabase = supabaseClient;
  }

  // -----------------------------------------------------------------------
  // Spots
  // -----------------------------------------------------------------------

  /**
   * Query the `spots` table with optional filters.
   *
   * @param {object} [filters={}]
   * @param {string} [filters.category] - Filter by spot category.
   * @param {string} [filters.status]   - Filter by status (e.g. `"approved"`).
   * @returns {Promise<{ spots: object[], error: Error|null }>}
   */
  async getSpots(filters = {}) {
    let query = this._supabase.from("spots").select("*");

    if (filters.category) {
      query = query.eq("category", filters.category);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) {
      return { spots: [], error: new Error(error.message) };
    }

    return { spots: data, error: null };
  }

  /**
   * Fetch a single spot by its primary key.
   *
   * @param {string|number} id
   * @returns {Promise<{ spot: object|null, error: Error|null }>}
   */
  async getSpotById(id) {
    const { data, error } = await this._supabase
      .from("spots")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return { spot: null, error: new Error(error.message) };
    }

    return { spot: data, error: null };
  }

  // -----------------------------------------------------------------------
  // Reviews
  // -----------------------------------------------------------------------

  /**
   * Fetch all reviews for a given spot.
   *
   * @param {string|number} spotId
   * @returns {Promise<{ reviews: object[], error: Error|null }>}
   */
  async getReviews(spotId) {
    const { data, error } = await this._supabase
      .from("reviews")
      .select("*")
      .eq("spot_id", spotId)
      .order("created_at", { ascending: false });

    if (error) {
      return { reviews: [], error: new Error(error.message) };
    }

    return { reviews: data, error: null };
  }

  /**
   * Insert a new review for a spot.
   *
   * @param {string|number} spotId
   * @param {string}        userId  - UUID of the reviewing user.
   * @param {number}        rating  - Numeric rating (e.g. 1-5).
   * @param {string}        comment - Review text.
   * @returns {Promise<{ review: object|null, error: Error|null }>}
   */
  async addReview(spotId, userId, rating, comment) {
    const { data, error } = await this._supabase
      .from("reviews")
      .insert({ spot_id: spotId, user_id: userId, rating, comment })
      .select()
      .single();

    if (error) {
      return { review: null, error: new Error(error.message) };
    }

    return { review: data, error: null };
  }

  // -----------------------------------------------------------------------
  // Saved spots
  // -----------------------------------------------------------------------

  /**
   * Retrieve all spots saved by a specific user.
   *
   * @param {string} userId
   * @returns {Promise<{ savedSpots: object[], error: Error|null }>}
   */
  async getSavedSpots(userId) {
    const { data, error } = await this._supabase
      .from("saved_spots")
      .select("id, user_id, spot_id, spots(name, category, entrance_fee)")
      .eq("user_id", userId);

    if (error) {
      return { savedSpots: [], error: new Error(error.message) };
    }

    return { savedSpots: data, error: null };
  }

  /**
   * Toggle a spot in the user's saved-spots list.
   *
   * If the spot is already saved it will be removed; otherwise a new row is
   * inserted.
   *
   * @param {string}        userId
   * @param {string|number} spotId
   * @returns {Promise<{ saved: boolean, error: Error|null }>}
   *   `saved` is `true` when the row was inserted, `false` when it was
   *   deleted.
   */
  async toggleSavedSpot(userId, spotId) {
    // Check if already saved
    const { data: existing } = await this._supabase
      .from("saved_spots")
      .select("id")
      .eq("user_id", userId)
      .eq("spot_id", spotId)
      .maybeSingle();

    if (existing) {
      // Remove
      const { error } = await this._supabase
        .from("saved_spots")
        .delete()
        .eq("id", existing.id);

      if (error) {
        return { saved: false, error: new Error(error.message) };
      }
      return { saved: false, error: null };
    }

    // Insert
    const { error } = await this._supabase
      .from("saved_spots")
      .insert({ user_id: userId, spot_id: spotId });

    if (error) {
      return { saved: false, error: new Error(error.message) };
    }

    return { saved: true, error: null };
  }

  // -----------------------------------------------------------------------
  // Itineraries
  // -----------------------------------------------------------------------

  /**
   * Fetch all itineraries belonging to a user.
   *
   * @param {string} userId
   * @returns {Promise<{ itineraries: object[], error: Error|null }>}
   */
  async getItineraries(userId) {
    const { data, error } = await this._supabase
      .from("itineraries")
      .select(
        "id, day_date, time_slot, estimated_duration, order, spot_id, spots(name, category, entrance_fee)",
      )
      .eq("user_id", userId)
      .order("day_date", { ascending: true })
      .order("order", { ascending: true });

    if (error) {
      return { itineraries: [], error: new Error(error.message) };
    }

    return { itineraries: data, error: null };
  }

  /**
   * Insert a spot into the user's itinerary for a specific day.
   *
   * @param {string}        userId   - UUID of the user.
   * @param {string|number} spotId   - ID of the spot to add.
   * @param {string}        dayDate  - ISO date string (e.g. "2025-03-20").
   * @param {string}        [timeSlot=null] - Optional time slot (e.g. "09:00").
   * @returns {Promise<{ item: object|null, error: Error|null }>}
   */
  async addToItinerary(userId, spotId, dayDate, timeSlot = null) {
    const insertData = { user_id: userId, spot_id: spotId, day_date: dayDate };
    if (timeSlot) insertData.time_slot = timeSlot;

    const { data, error } = await this._supabase
      .from("itineraries")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      return { item: null, error: new Error(error.message) };
    }

    return { item: data, error: null };
  }

  /**
   * Remove an itinerary entry by its ID (scoped to the user for safety).
   *
   * @param {string|number} itemId - Primary key of the itinerary row.
   * @param {string}        userId - UUID of the owning user.
   * @returns {Promise<{ error: Error|null }>}
   */
  async removeFromItinerary(itemId, userId) {
    const { error } = await this._supabase
      .from("itineraries")
      .delete()
      .eq("id", itemId)
      .eq("user_id", userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  }

  // -----------------------------------------------------------------------
  // Admin CRUD
  // -----------------------------------------------------------------------

  /**
   * Create a new spot in the `spots` table.
   *
   * @param {object} data - Spot fields to insert.
   * @returns {Promise<{ spot: object|null, error: Error|null }>}
   */
  async createSpot(data) {
    const { data: spot, error } = await this._supabase
      .from("spots")
      .insert(data)
      .select("*")
      .single();
    if (error) return { spot: null, error: new Error(error.message) };
    return { spot, error: null };
  }

  /**
   * Update an existing spot by its primary key.
   *
   * @param {string|number} id   - ID of the spot to update.
   * @param {object}        data - Fields to update.
   * @returns {Promise<{ spot: object|null, error: Error|null }>}
   */
  async updateSpot(id, data) {
    const { data: spot, error } = await this._supabase
      .from("spots")
      .update(data)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return { spot: null, error: new Error(error.message) };
    return { spot, error: null };
  }

  /**
   * Delete a spot by its primary key.
   *
   * @param {string|number} id - ID of the spot to delete.
   * @returns {Promise<{ error: Error|null }>}
   */
  async deleteSpot(id) {
    const { error } = await this._supabase.from("spots").delete().eq("id", id);
    if (error) return { error: new Error(error.message) };
    return { error: null };
  }

  /**
   * Get aggregate stats for the admin dashboard.
   *
   * @returns {Promise<{ stats: object|null, error: Error|null }>}
   *   `stats` shape: `{ total, active, draft, categories }`.
   */
  async getSpotStats() {
    const { data: spots, error } = await this._supabase
      .from("spots")
      .select("status, category");
    if (error) return { stats: null, error: new Error(error.message) };

    const total = spots.length;
    const active = spots.filter((s) => s.status === "active").length;
    const draft = spots.filter((s) => s.status === "draft").length;
    const categories = [...new Set(spots.map((s) => s.category))].length;

    return { stats: { total, active, draft, categories }, error: null };
  }

  /**
   * Get user stats from the `profiles` table.
   *
   * @returns {Promise<{ stats: object|null, error: Error|null }>}
   *   `stats` shape: `{ total, admins, recent }`.
   */
  async getUserStats() {
    const { data: profiles, error } = await this._supabase
      .from("profiles")
      .select("role, created_at")
      .order("created_at", { ascending: false });
    if (error) return { stats: null, error: new Error(error.message) };

    const total = profiles.length;
    const admins = profiles.filter((p) => p.role === "admin").length;
    const recent = profiles.slice(0, 10);

    return { stats: { total, admins, recent }, error: null };
  }
}
