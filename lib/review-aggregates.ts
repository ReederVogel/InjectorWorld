type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null }>
}

export async function recomputeClinicReviewAggregates(pool: Queryable, clinicIds?: number[]): Promise<number> {
  const ids = Array.from(new Set((clinicIds ?? []).filter((id) => Number.isInteger(id) && id > 0)))
  const params: unknown[] = ids.length > 0 ? [ids] : []
  const targetSql = ids.length > 0
    ? 'SELECT unnest($1::int[]) AS id'
    : 'SELECT id FROM clinics'

  const result = await pool.query(
    `
      WITH target_clinics AS (
        ${targetSql}
      ),
      approved_review_stats AS (
        SELECT
          r.clinic_id,
          ROUND(AVG(r.rating)::numeric, 1) AS aggregate_rating,
          COUNT(*)::int AS aggregate_rating_count
        FROM reviews r
        JOIN target_clinics tc ON tc.id = r.clinic_id
        WHERE r.moderation_status = 'approved'
          AND r.rating IS NOT NULL
        GROUP BY r.clinic_id
      ),
      next_values AS (
        SELECT
          tc.id,
          ars.aggregate_rating,
          COALESCE(ars.aggregate_rating_count, 0)::int AS aggregate_rating_count
        FROM target_clinics tc
        LEFT JOIN approved_review_stats ars ON ars.clinic_id = tc.id
      )
      UPDATE clinics c
      SET
        aggregate_rating = nv.aggregate_rating,
        aggregate_rating_count = nv.aggregate_rating_count,
        updated_at = NOW()
      FROM next_values nv
      WHERE c.id = nv.id
        AND (
          c.aggregate_rating IS DISTINCT FROM nv.aggregate_rating
          OR c.aggregate_rating_count IS DISTINCT FROM nv.aggregate_rating_count
        )
    `,
    params,
  )

  return result.rowCount ?? 0
}
