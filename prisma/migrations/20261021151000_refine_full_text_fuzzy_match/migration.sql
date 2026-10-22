-- Require every query term to resemble a word in the title. This keeps typo
-- tolerance without returning documents that only share one common token.
CREATE OR REPLACE FUNCTION localgo_all_terms_fuzzy_match(
  query_text text,
  candidate_text text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT COALESCE(
    bool_and(
      word_similarity(term, localgo_normalize_search_text(candidate_text)) >=
        CASE WHEN length(term) < 3 THEN 0.8 ELSE 0.55 END
    ),
    false
  )
  FROM unnest(
    regexp_split_to_array(localgo_normalize_search_text(query_text), '\\s+')
  ) AS term
  WHERE term <> '';
$$;
