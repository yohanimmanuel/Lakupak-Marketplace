import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Pressable, TextInput, View, StyleSheet } from 'react-native';
import { Search as SearchIcon, X } from 'lucide-react-native';

export type SearchInputBarHandle = {
  focus: () => void;
  clear: () => void;
  getText: () => string;
};

type SearchInputBarProps = {
  seedText: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onSubmit: (text: string) => void;
};

/**
 * Self-contained search field. Text lives here only — parent re-renders must not
 * remount or re-control this input (avoids RN TextInput duplication glitches).
 */
const SearchInputBar = forwardRef<SearchInputBarHandle, SearchInputBarProps>(function SearchInputBar(
  { seedText, placeholder, onChangeText, onFocus, onSubmit },
  ref,
) {
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState(seedText);
  const textRef = useRef(seedText);
  const lastSeedRef = useRef(seedText);

  const handlersRef = useRef({ onChangeText, onFocus, onSubmit });
  handlersRef.current = { onChangeText, onFocus, onSubmit };

  useEffect(() => {
    if (seedText === lastSeedRef.current) return;
    lastSeedRef.current = seedText;
    textRef.current = seedText;
    setText(seedText);
  }, [seedText]);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      textRef.current = '';
      setText('');
      handlersRef.current.onChangeText('');
    },
    getText: () => textRef.current,
  }));

  const handleChange = useCallback((value: string) => {
    textRef.current = value;
    setText(value);
    handlersRef.current.onChangeText(value);
  }, []);

  const handleFocus = useCallback(() => {
    handlersRef.current.onFocus();
  }, []);

  const handleSubmit = useCallback(() => {
    handlersRef.current.onSubmit(text);
  }, [text]);

  const handleClear = useCallback(() => {
    textRef.current = '';
    setText('');
    handlersRef.current.onChangeText('');
    inputRef.current?.focus();
  }, []);

  return (
    <View style={styles.searchBar}>
      <SearchIcon color="#6B7280" size={20} />
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onSubmitEditing={handleSubmit}
        placeholder={placeholder}
        style={styles.searchInput}
        placeholderTextColor="#6B7280"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {text ? (
        <Pressable onPress={handleClear} style={styles.clearButton} hitSlop={8}>
          <X color="#6B7280" size={20} />
        </Pressable>
      ) : null}
    </View>
  );
});

export default React.memo(SearchInputBar, (prev, next) => {
  return prev.seedText === next.seedText && prev.placeholder === next.placeholder;
});

const styles = StyleSheet.create({
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 40,
    marginLeft: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
});
