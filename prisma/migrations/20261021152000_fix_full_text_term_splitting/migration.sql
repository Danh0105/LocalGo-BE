-- POSIX character classes avoid differences in backslash handling between
-- PostgreSQL string settings and migration clients.
CREATE OR REPLACE FUNCTION localgo_prefix_tsquery(input text)
RETURNS tsquery
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT to_tsquery(
    'simple',
    string_agg(quote_literal(term) || ':*', ' & ')
  )
  FROM unnest(
    regexp_split_to_array(
      localgo_normalize_search_text(input),
      '[[:space:]]+'
    )
  ) AS term
  WHERE term <> '';
$$;

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
    regexp_split_to_array(
      localgo_normalize_search_text(query_text),
      '[[:space:]]+'
    )
  ) AS term
  WHERE term <> '';
$$;
