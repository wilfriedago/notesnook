import React, { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { notesnook } from '../../../e2e/test.ids';
import { useThemeStore } from '../../stores/theme';
import { useUserStore } from '../../stores/stores';
import { eSendEvent } from '../../services/event-manager';
import Sync from '../../services/sync';
import { db } from '../../utils/database';
import { eScrollEvent } from '../../utils/events';
import JumpToSectionDialog from '../dialogs/jump-to-section';
import { NotebookWrapper } from '../list-items/notebook/wrapper';
import { NoteWrapper } from '../list-items/note/wrapper';
import TagItem from '../list-items/tag';
import { Empty } from './empty';
import { Footer } from '../list-items/footer';
import { Header } from '../list-items/headers/header';
import { SectionHeader } from '../list-items/headers/section-header';
import { tabBarRef } from '../../utils/global-refs';

const renderItems = {
  note: NoteWrapper,
  notebook: NotebookWrapper,
  topic: NotebookWrapper,
  tag: TagItem,
  section: SectionHeader,
  header: SectionHeader
};

const RenderItem = ({ item, index, type, ...restArgs }) => {
  if (!item) return <View />;
  const Item = renderItems[item.itemType || item.type] || View;
  const groupOptions = db.settings?.getGroupOptions(type);
  const dateBy = groupOptions.sortBy !== 'title' ? groupOptions.sortBy : 'dateEdited';

  let tags =
    item.tags
      ?.slice(0, 3)
      ?.map(item => {
        let tag = db.tags.tag(item);

        if (!tag) return null;
        return {
          title: tag.title,
          id: tag.id,
          alias: tag.alias
        };
      })
      .filter(t => t !== null) || [];
  return <Item item={item} tags={tags} dateBy={dateBy} index={index} type={type} {...restArgs} />;
};

const List = ({
  listData,
  type,
  refreshCallback,
  placeholderData,
  loading,
  headerProps = {
    heading: 'Home'
  },
  screen,
  ListHeader,
  warning
}) => {
  const colors = useThemeStore(state => state.colors);
  const scrollRef = useRef();
  const [_loading, _setLoading] = useState(true);
  const syncing = useUserStore(state => state.syncing);

  useEffect(() => {
    let timeout = null;
    if (!loading) {
      timeout = setTimeout(
        () => {
          _setLoading(false);
        },
        listData.length === 0 ? 0 : 300
      );
    } else {
      _setLoading(true);
    }
    return () => {
      clearTimeout(timeout);
    };
  }, [loading]);

  const renderItem = React.useCallback(
    ({ item, index }) => (
      <RenderItem
        item={item}
        index={index}
        color={headerProps.color}
        title={headerProps.heading}
        type={screen === 'Notes' ? 'home' : type}
        screen={screen}
      />
    ),
    []
  );

  const _onRefresh = async () => {
    await Sync.run();
    if (refreshCallback) {
      refreshCallback();
    }
  };

  const _onScroll = React.useCallback(
    event => {
      if (!event) return;
      let y = event.nativeEvent.contentOffset.y;
      eSendEvent(eScrollEvent, {
        y,
        screen
      });
    },
    [screen]
  );

  let styles = {
    width: '100%',
    minHeight: 1,
    minWidth: 1,
    backgroundColor: colors.bg
  };

  const _keyExtractor = item => item.id || item.title;

  return (
    <>
      <FlatList
        style={styles}
        keyExtractor={_keyExtractor}
        ref={scrollRef}
        testID={notesnook.list.id}
        data={_loading ? listData.slice(0, 9) : listData}
        renderItem={renderItem}
        onScroll={_onScroll}
        onMomentumScrollEnd={() => {
          tabBarRef.current?.unlock();
        }}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.nav}
            onRefresh={_onRefresh}
            refreshing={syncing}
          />
        }
        ListEmptyComponent={
          <Empty
            loading={loading || _loading}
            placeholderData={placeholderData}
            headerProps={headerProps}
            type={type}
            screen={screen}
          />
        }
        ListFooterComponent={<Footer />}
        ListHeaderComponent={
          <>
            {ListHeader ? (
              ListHeader
            ) : (
              <Header
                title={headerProps.heading}
                paragraph={headerProps.paragraph}
                onPress={headerProps.onPress}
                icon={headerProps.icon}
                color={headerProps.color}
                type={type}
                screen={screen}
                warning={warning}
              />
            )}
          </>
        }
      />
      <JumpToSectionDialog
        screen={screen}
        data={listData}
        type={screen === 'Notes' ? 'home' : type}
        scrollRef={scrollRef}
      />
    </>
  );
};

export default List;
