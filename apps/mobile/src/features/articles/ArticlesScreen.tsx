import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { theme } from "../../theme/theme";
import { useCurrentFocus } from "../focus/useCurrentFocus";
import { buildDocumentScopeFilter } from "../focus/focusScope";

type Article = {
  id: string;
  category: string;
  title: string;
  body: string;
  chunkOrder: number;
};

export function ArticlesScreen() {
  const insets = useSafeAreaInsets();
  const { currentFocusId, currentFocus } = useCurrentFocus();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    let active = true;
    async function loadArticles() {
      setLoading(true);
      setError(null);
      try {
        const chunksQuery = supabase
          .from("document_chunks")
          .select("id,category,chunk_text,chunk_order,documents!inner(scope,focus_id)")
          .order("chunk_order", { ascending: true });
        const { data: chunks, error: chunksError } = await chunksQuery.or(buildDocumentScopeFilter(currentFocusId), {
          foreignTable: "documents"
        });
        if (chunksError) throw chunksError;

        const mapped = (chunks ?? [])
          .map((chunk) => {
            const text = (chunk.chunk_text ?? "").trim();
            const [firstLine = "Untitled", ...restLines] = text.split("\n");
            const splitByParagraph = text.split(/\n\s*\n/);
            const title = (splitByParagraph[0] || firstLine).replace(/^#+\s*/, "").trim();
            const body = (splitByParagraph.slice(1).join("\n\n") || restLines.join("\n")).trim();
            return {
              id: chunk.id as string,
              category: (chunk.category as string) || "General",
              title: title || "Untitled",
              body: body || text,
              chunkOrder: (chunk.chunk_order as number) ?? 0
            };
          })
          .filter((article) => article.body.length > 40);

        if (!active) return;
        setArticles(mapped);
      } catch (err) {
        if (!active) return;
        setError((err as Error).message || "Failed to load articles.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadArticles();
    return () => {
      active = false;
    };
  }, [currentFocusId]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(articles.map((article) => article.category))).sort((a, b) => a.localeCompare(b));
    return ["All", ...unique];
  }, [articles]);

  const visibleArticles = useMemo(
    () => articles.filter((article) => selectedCategory === "All" || article.category === selectedCategory),
    [articles, selectedCategory]
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {categories.map((category) => (
          <Pressable
            key={category}
            style={[styles.chip, selectedCategory === category && styles.chipActive]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[styles.chipText, selectedCategory === category && styles.chipTextActive]}>{category}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 120) }]}>
        <Text style={styles.title}>Articles: {currentFocus?.name ?? "Focus"}</Text>
        {loading ? <Text style={styles.stateText}>Loading articles...</Text> : null}
        {!loading && error ? <Text style={styles.stateText}>{error}</Text> : null}
        {!loading && !error && visibleArticles.length === 0 ? (
          <Text style={styles.stateText}>No articles in this category yet.</Text>
        ) : null}
        {visibleArticles.map((article) => (
          <Pressable key={article.id} style={styles.card} onPress={() => setSelectedArticle(article)}>
            <Text style={styles.category}>{article.category}</Text>
            <Text style={styles.articleTitle}>{article.title}</Text>
            <Text style={styles.item} numberOfLines={3}>
              {article.body}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={!!selectedArticle} animationType="slide" onRequestClose={() => setSelectedArticle(null)}>
        <View style={[styles.modalScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalCategory}>{selectedArticle?.category}</Text>
            <Pressable onPress={() => setSelectedArticle(null)} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedArticle?.title}</Text>
            <Text style={styles.modalBody}>{selectedArticle?.body}</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  chips: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface
  },
  chipActive: {
    borderColor: theme.colors.accent
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700"
  },
  chipTextActive: {
    color: theme.colors.accent
  },
  content: { padding: theme.spacing.md, gap: theme.spacing.md },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title1,
    fontWeight: "800"
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm
  },
  category: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700"
  },
  articleTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subtitle,
    fontWeight: "700"
  },
  item: {
    color: theme.colors.textSecondary
  },
  stateText: {
    color: theme.colors.textSecondary
  },
  modalScreen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  modalHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  modalCategory: {
    color: theme.colors.accent,
    fontWeight: "700"
  },
  closeButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  closeText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  modalContent: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title2,
    fontWeight: "800"
  },
  modalBody: {
    color: theme.colors.textSecondary,
    lineHeight: 22
  }
});
