// ---------------------------------------------------------------------------
// Tool definitions & handlers for Mistral native function calling.
//
// Each tool handler receives:
//   args      — parsed JSON object of function arguments
//   supabase  — the admin Supabase client
//   userId    — the authenticated user's UUID (string) or undefined
//
// Each handler returns a string that is fed back to Mistral as a tool result.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. TOOL DEFINITIONS (Mistral format)
// ---------------------------------------------------------------------------
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "get_itinerary",
      description:
        "Get the user's upcoming itinerary. Returns their planned spots grouped by day with times and details.",
      parameters: {
        type: "object",
        properties: {
          day_date: {
            type: "string",
            description:
              "Optional date in YYYY-MM-DD format. If omitted, returns all itinerary items.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_itinerary",
      description:
        "Add a spot to the user's trip plan for a specific day and optional time.",
      parameters: {
        type: "object",
        properties: {
          spot_name: {
            type: "string",
            description:
              "The name of the spot to add (e.g. 'Fort Santiago', 'Rizal Park')",
          },
          day_date: {
            type: "string",
            description: "The date in YYYY-MM-DD format (e.g. '2025-06-15')",
          },
          time_slot: {
            type: "string",
            description:
              "Optional time in HH:MM format (e.g. '09:00', '14:30')",
          },
          estimated_duration: {
            type: "string",
            description:
              "Optional estimated duration (e.g. '2 hours', '1.5 hrs')",
          },
          order: {
            type: "integer",
            description:
              "Optional order/position in the day's itinerary (0-based)",
          },
        },
        required: ["spot_name", "day_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_from_itinerary",
      description:
        "Remove a spot from the user's trip plan. Can remove by the item's ID, or by giving the spot name and date.",
      parameters: {
        type: "object",
        properties: {
          item_id: {
            type: "integer",
            description: "The itinerary item ID to remove",
          },
          spot_name: {
            type: "string",
            description:
              "Alternative: the spot name to remove (used together with day_date)",
          },
          day_date: {
            type: "string",
            description:
              "Alternative: the date (used together with spot_name) in YYYY-MM-DD format",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_itinerary_item",
      description:
        "Change an existing itinerary item — update its time, move it to a different day, or adjust the order.",
      parameters: {
        type: "object",
        properties: {
          item_id: {
            type: "integer",
            description: "The itinerary item ID to update",
          },
          time_slot: {
            type: "string",
            description: "New time in HH:MM format (e.g. '11:00')",
          },
          day_date: {
            type: "string",
            description: "New date in YYYY-MM-DD format",
          },
          order: {
            type: "integer",
            description: "New order/position",
          },
          estimated_duration: {
            type: "string",
            description: "New estimated duration",
          },
        },
        required: ["item_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_spots",
      description:
        "Search for tourist spots in Manila by name or category. Returns spot details like fees, hours, and what to expect.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search term — spot name or category (e.g. 'Intramuros', 'museum', 'park')",
          },
        },
        required: ["query"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// 2. TOOL HANDLER DISPATCHER
// ---------------------------------------------------------------------------

/**
 * Execute the named tool with the given arguments and return a string result
 * suitable for feeding back into the Mistral conversation.
 *
 * @param {string} toolName
 * @param {object} args       Parsed function arguments
 * @param {object} supabase   Supabase admin client
 * @param {string|null} userId
 * @returns {Promise<string>}
 */
async function executeTool(toolName, args, supabase, userId) {
  switch (toolName) {
    case "get_itinerary":
      return await handleGetItinerary(args, supabase, userId);
    case "add_to_itinerary":
      return await handleAddToItinerary(args, supabase, userId);
    case "remove_from_itinerary":
      return await handleRemoveFromItinerary(args, supabase, userId);
    case "update_itinerary_item":
      return await handleUpdateItineraryItem(args, supabase, userId);
    case "search_spots":
      return await handleSearchSpots(args, supabase);
    default:
      return `Unknown tool: ${toolName}`;
  }
}

module.exports = { TOOL_DEFINITIONS, executeTool };

// ===================================================================
// 3. INDIVIDUAL HANDLERS
// ===================================================================

// -------------------------------------------------------------------
// GET ITINERARY
// -------------------------------------------------------------------
async function handleGetItinerary(args, supabase, userId) {
  if (!userId) {
    return "I need to know who you are to look up your itinerary. Please sign in first.";
  }

  const { day_date } = args;

  // Build the query — join itineraries with spots for full details
  let query = supabase
    .from("itineraries")
    .select(
      "id, day_date, time_slot, estimated_duration, order, " +
        "spot_id, spots(name, category, description, entrance_fee, operating_hours)",
    )
    .eq("user_id", userId)
    .order("day_date", { ascending: true })
    .order("order", { ascending: true });

  if (day_date) {
    query = query.eq("day_date", day_date);
  }

  const { data, error } = await query;

  if (error) {
    return `Error fetching itinerary: ${error.message}`;
  }

  if (!data || data.length === 0) {
    if (day_date) {
      return "You don't have anything planned for that day yet. Want me to suggest some places to visit?";
    }
    return "Your trip is still a blank canvas! You haven't added any spots yet. Would you like me to help you plan your Manila adventure?";
  }

  // Group by date with friendly labels
  let result = "Here's what I found in your itinerary:\n\n";
  let currentDay = "";
  for (const item of data) {
    const spot = item.spots;
    const name = spot ? spot.name : `Spot #${item.spot_id}`;
    const time = item.time_slot
      ? formatTimeNicely(item.time_slot)
      : "no time set";
    const dur = item.estimated_duration || "";

    const displayDate = formatDateNicely(item.day_date);
    if (displayDate !== currentDay) {
      currentDay = displayDate;
      result += `📅 ${displayDate}\n`;
    }
    result += `  • ${name} at ${time}`;
    if (dur) result += ` (about ${dur})`;
    result += `\n`;
  }

  return result;
}

// -------------------------------------------------------------------
// ADD TO ITINERARY
// -------------------------------------------------------------------
async function handleAddToItinerary(args, supabase, userId) {
  if (!userId) {
    return "I need to know who you are to add to your itinerary. Please sign in first.";
  }

  const { spot_name, day_date, time_slot, estimated_duration, order } = args;

  if (!spot_name || !day_date) {
    return "Missing required fields: spot_name and day_date are both required.";
  }

  // Step 1 — Find the spot by name (case-insensitive)
  const { data: spots, error: searchError } = await supabase
    .from("spots")
    .select("id, name, category")
    .ilike("name", `%${spot_name}%`);

  if (searchError) {
    return `Error searching for spot: ${searchError.message}`;
  }

  if (!spots || spots.length === 0) {
    return (
      `I couldn't find a spot matching "${spot_name}". ` +
      `Try using the search_spots function first to find the correct spot name.`
    );
  }

  // If multiple matches, pick the first one but note it
  const matchedSpot = spots[0];
  const matchNote =
    spots.length > 1
      ? ` (matched "${matchedSpot.name}" out of ${spots.length} results)`
      : "";

  // Step 2 — Insert the itinerary item
  const newItem = {
    user_id: userId,
    spot_id: matchedSpot.id,
    day_date,
  };

  if (time_slot) newItem.time_slot = time_slot;
  if (estimated_duration) newItem.estimated_duration = estimated_duration;
  if (order !== undefined && order !== null) newItem.order = order;

  const { data: inserted, error: insertError } = await supabase
    .from("itineraries")
    .insert(newItem)
    .select("id, day_date, time_slot, order")
    .single();

  if (insertError) {
    // Handle UNIQUE constraint violation gracefully
    if (insertError.code === "23505") {
      return (
        `"${matchedSpot.name}" is already in your itinerary for ${day_date} ` +
        `at that time slot. You can update it with the update_itinerary_item tool instead.`
      );
    }
    return `Error adding to itinerary: ${insertError.message}`;
  }

  const friendlyDate = formatDateNicely(inserted.day_date);
  const friendlyTime = inserted.time_slot
    ? ` at ${formatTimeNicely(inserted.time_slot)}`
    : "";
  return (
    `Great choice! I've added ${matchedSpot.name} to your itinerary${matchNote}.\n` +
    `It's now scheduled for ${friendlyDate}${friendlyTime}.`
  );
}

// -------------------------------------------------------------------
// REMOVE FROM ITINERARY
// -------------------------------------------------------------------
async function handleRemoveFromItinerary(args, supabase, userId) {
  if (!userId) {
    return "I need to know who you are to modify your itinerary. Please sign in first.";
  }

  const { item_id, spot_name, day_date } = args;

  // --- Approach A: Remove by item_id ---
  if (item_id) {
    // Verify ownership before deleting
    const { data: row, error: lookupError } = await supabase
      .from("itineraries")
      .select("id, spot_id, day_date, spots(name)")
      .eq("id", item_id)
      .eq("user_id", userId)
      .single();

    if (lookupError || !row) {
      return (
        `Itinerary item with ID ${item_id} was not found ` +
        `in your itinerary. It may belong to a different user or doesn't exist.`
      );
    }

    const { error: deleteError } = await supabase
      .from("itineraries")
      .delete()
      .eq("id", item_id)
      .eq("user_id", userId);

    if (deleteError) {
      return `Error removing itinerary item: ${deleteError.message}`;
    }

    const spotName = row.spots ? row.spots.name : `Spot #${row.spot_id}`;
    const friendlyDate = formatDateNicely(row.day_date);
    return `Done! I've taken ${spotName} off your itinerary for ${friendlyDate}.`;
  }

  // --- Approach B: Remove by spot_name + day_date ---
  if (spot_name && day_date) {
    // Find matching items first
    const { data: matches, error: matchError } = await supabase
      .from("itineraries")
      .select("id, spot_id, day_date, time_slot, spots!inner(name)")
      .eq("user_id", userId)
      .eq("day_date", day_date)
      .ilike("spots.name", `%${spot_name}%`);

    if (matchError) {
      return `Error finding itinerary items: ${matchError.message}`;
    }

    if (!matches || matches.length === 0) {
      return `No items matching "${spot_name}" found in your itinerary for ${day_date}.`;
    }

    // If multiple, remove all matches
    const ids = matches.map((m) => m.id);
    const namesRemoved = matches.map((m) => m.spots.name).join(", ");
    const friendlyDate = formatDateNicely(day_date);

    const { error: deleteError } = await supabase
      .from("itineraries")
      .delete()
      .in("id", ids)
      .eq("user_id", userId);

    if (deleteError) {
      return `Error removing itinerary items: ${deleteError.message}`;
    }

    return `All done! I've removed ${namesRemoved} from your ${friendlyDate} itinerary.`;
  }

  return "Please provide either an item_id, or both spot_name and day_date to remove.";
}

// -------------------------------------------------------------------
// UPDATE ITINERARY ITEM
// -------------------------------------------------------------------
async function handleUpdateItineraryItem(args, supabase, userId) {
  if (!userId) {
    return "I need to know who you are to modify your itinerary. Please sign in first.";
  }

  const { item_id, time_slot, day_date, order, estimated_duration } = args;

  if (!item_id) {
    return "Missing required field: item_id is required to update an itinerary item.";
  }

  // Verify ownership
  const { data: existing, error: lookupError } = await supabase
    .from("itineraries")
    .select("id, day_date, time_slot, order, spot_id, spots(name)")
    .eq("id", item_id)
    .eq("user_id", userId)
    .single();

  if (lookupError || !existing) {
    return (
      `Itinerary item with ID ${item_id} was not found ` +
      `in your itinerary. It may belong to a different user or doesn't exist.`
    );
  }

  // Build the update object with only provided fields
  const updates = {};
  if (time_slot !== undefined && time_slot !== null)
    updates.time_slot = time_slot;
  if (day_date !== undefined && day_date !== null) updates.day_date = day_date;
  if (order !== undefined && order !== null) updates.order = order;
  if (estimated_duration !== undefined && estimated_duration !== null) {
    updates.estimated_duration = estimated_duration;
  }

  if (Object.keys(updates).length === 0) {
    return "No fields to update were provided. Use time_slot, day_date, order, and/or estimated_duration.";
  }

  const { data: updated, error: updateError } = await supabase
    .from("itineraries")
    .update(updates)
    .eq("id", item_id)
    .eq("user_id", userId)
    .select("id, day_date, time_slot, order, estimated_duration")
    .single();

  if (updateError) {
    // UNIQUE constraint — might be moving to a conflicting slot
    if (updateError.code === "23505") {
      return `Cannot update: the new date/time slot is already occupied by another item.`;
    }
    return `Error updating itinerary item: ${updateError.message}`;
  }

  const spotName = existing.spots
    ? existing.spots.name
    : `Spot #${existing.spot_id}`;
  const changes = [];
  if (updates.time_slot)
    changes.push(`time changed to ${formatTimeNicely(updates.time_slot)}`);
  if (updates.day_date)
    changes.push(`date moved to ${formatDateNicely(updates.day_date)}`);
  if (updates.order !== undefined) changes.push(`order updated`);
  if (updates.estimated_duration)
    changes.push(`duration set to ${updates.estimated_duration}`);
  const changeText = changes.length > 0 ? changes.join(", ") : "updated";

  return `Got it! I've updated ${spotName} — ${changeText}.`;
}

// -------------------------------------------------------------------
// SEARCH SPOTS
// -------------------------------------------------------------------
async function handleSearchSpots(args, supabase) {
  const { query } = args;

  if (!query) {
    return "Please provide a search query to find spots.";
  }

  const { data, error } = await supabase
    .from("spots")
    .select("id, name, category, description, entrance_fee, operating_hours")
    .eq("status", "active")
    .or(`name.ilike.%${query}%,category.ilike.%${query}%`)
    .order("name", { ascending: true })
    .limit(10);

  if (error) {
    return `Error searching spots: ${error.message}`;
  }

  if (!data || data.length === 0) {
    return `No spots found matching "${query}". Try a different search term.`;
  }

  let result = `Here are some spots matching "${query}" that I found for you:\n\n`;

  for (const spot of data) {
    result += `**${spot.name}**\n`;
    result += `  ${spot.category} · ${spot.entrance_fee || "Fee varies"} · ${spot.operating_hours || "Hours may vary"}\n`;
    if (spot.description) {
      // Keep description brief in tool output
      const brief =
        spot.description.length > 200
          ? spot.description.slice(0, 197) + "..."
          : spot.description;
      result += `  ${brief}\n`;
    }
    result += "\n";
  }

  return result;
}

// ===================================================================
// 4. HELPER FUNCTIONS
// ===================================================================

/**
 * Convert a YYYY-MM-DD date string to a friendly format like "Friday, June 15".
 */
function formatDateNicely(dateStr) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const options = { weekday: "long", month: "long", day: "numeric" };
    return d.toLocaleDateString("en-US", options);
  } catch {
    return dateStr;
  }
}

/**
 * Convert a HH:MM:SS or HH:MM time string to a 12-hour format like "9:00 AM".
 */
function formatTimeNicely(timeStr) {
  try {
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
}
