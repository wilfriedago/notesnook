import React, {useEffect, useRef, useState} from 'react';
import {Platform, TouchableOpacity, View} from 'react-native';
import {FlatList} from 'react-native-gesture-handler';
import * as Progress from 'react-native-progress';
import * as ScopedStorage from 'react-native-scoped-storage';
import Sodium from 'react-native-sodium';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTracked} from '../../provider';
import {useAttachmentStore} from '../../provider/stores';
import {
  eSubscribeEvent,
  eUnSubscribeEvent,
  ToastEvent
} from '../../services/EventManager';
import {db} from '../../utils/database';
import {
  eCloseAttachmentDialog,
  eOpenAttachmentsDialog
} from '../../utils/Events';
import filesystem from '../../utils/filesystem';
import {SIZE} from '../../utils/SizeUtils';
import Storage from '../../utils/storage';
import {ActionIcon} from '../ActionIcon';
import ActionSheetWrapper from '../ActionSheetComponent/ActionSheetWrapper';
import DialogHeader from '../Dialog/dialog-header';
import Paragraph from '../Typography/Paragraph';

export const AttachmentDialog = () => {
  const [state] = useTracked();
  const colors = state.colors;
  const [visible, setVisible] = useState(false);
  const [note, setNote] = useState(null);
  const actionSheetRef = useRef();
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    eSubscribeEvent(eOpenAttachmentsDialog, open);
    eSubscribeEvent(eCloseAttachmentDialog, close);
    return () => {
      eUnSubscribeEvent(eOpenAttachmentsDialog, open);
      eUnSubscribeEvent(eCloseAttachmentDialog, close);
    };
  }, [visible]);

  const open = item => {
    setNote(item);
    setVisible(true);
    let _attachments = db.attachments.ofNote(item.id)
    setAttachments(_attachments);
  };

  useEffect(() => {
    if (visible) {
      actionSheetRef.current?.show();
    }
  }, [visible]);

  const close = () => {
    actionSheetRef.current?.hide();
    setVisible(false);
  };

  return !visible ? null : (
    <ActionSheetWrapper
      centered={false}
      fwdRef={actionSheetRef}
      onClose={async () => {
        setVisible(false);
      }}>
      <View
        style={{
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: 12
        }}>
        <DialogHeader title="Attachments" />
        <FlatList
          nestedScrollEnabled
          overScrollMode="never"
          scrollToOverflowEnabled={false}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="always"
          onMomentumScrollEnd={() => {
            actionSheetRef.current?.handleChildScrollEnd();
          }}
          ListEmptyComponent={
            <View
              style={{
                height: 150,
                justifyContent: 'center',
                alignItems: 'center'
              }}>
              <Icon name="attachment" size={60} color={colors.icon} />
              <Paragraph>No attachments on this note</Paragraph>
            </View>
          }
          data={attachments}
          renderItem={({item, index}) => (
            <Attachment attachment={item} note={note} setNote={setNote} />
          )}
        />

        <Paragraph
          color={colors.icon}
          size={SIZE.xs}
          style={{
            textAlign: 'center',
            marginTop: 10
          }}>
          <Icon name="shield-key-outline" size={SIZE.xs} color={colors.icon} />
          {'  '}All attachments are end-to-end encrypted.
        </Paragraph>
      </View>
    </ActionSheetWrapper>
  );
};

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFileExtension(filename) {
  var ext = /^.+\.([^.]+)$/.exec(filename);
  return ext == null ? '' : ext[1];
}

const Attachment = ({attachment, note, setNote}) => {
  const [state] = useTracked();
  const colors = state.colors;
  const progress = useAttachmentStore(state => state.progress);
  const [currentProgress, setCurrentProgress] = useState(null);

  const onPress = async () => {
    if (currentProgress) {
      db.fs.cancel(attachment.metadata.hash, 'download');
      useAttachmentStore.getState().remove(attachment.metadata.hash);
      return;
    }
    filesystem.downloadAttachment(attachment.metadata.hash);
  };

  useEffect(() => {
    let prog = progress[attachment.metadata.hash];
    if (prog) {
      let type = prog.type;
      let loaded = prog.type === 'download' ? prog.recieved : prog.sent;
      prog = loaded / prog.total;
      prog = (prog * 100).toFixed(0);
      console.log('progress: ', prog);
      console.log(prog);
      setCurrentProgress({
        value: prog,
        percent: prog + '%',
        type: type
      });
    } else {
      setCurrentProgress(null);
    }
  }, [progress]);

  return (
    <View
      style={{
        flexDirection: 'row',
        marginVertical: 5,
        justifyContent: 'space-between',
        padding: 12,
        paddingVertical: 6,
        borderRadius: 5,
        backgroundColor: colors.nav
      }}
      type="grayBg">
      <View
        style={{
          flexShrink: 1,
          flexDirection: 'row',
          alignItems: 'center'
        }}>
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: -5
          }}>
          <Icon name="file" size={SIZE.xxxl} color={colors.icon} />

          <Paragraph
            adjustsFontSizeToFit
            size={6}
            color={colors.light}
            style={{
              position: 'absolute'
            }}>
            {getFileExtension(attachment.metadata.filename).toUpperCase()}
          </Paragraph>
        </View>

        <View
          style={{
            flexShrink: 1,
            marginLeft: 10
          }}>
          <Paragraph
            size={SIZE.sm - 1}
            style={{
              flexWrap: 'wrap',
              marginBottom: 2.5
            }}
            numberOfLines={1}
            lineBreakMode="middle"
            color={colors.pri}>
            {attachment.metadata.filename}
          </Paragraph>

          <Paragraph color={colors.icon} size={SIZE.xs}>
            {formatBytes(attachment.length)}{' '}
            {currentProgress?.type ? '(' + currentProgress.type + 'ing - tap to cancel)' : ''}
          </Paragraph>
        </View>
      </View>

      {currentProgress ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            db.fs.cancel(attachment.metadata.hash);
            setCurrentProgress(null);
          }}
          style={{
            justifyContent: 'center',
            marginLeft: 5,
            marginTop:5,
            marginRight:-5
          }}>
          <Progress.Circle
            size={SIZE.xxl}
            progress={currentProgress?.value ? currentProgress?.value / 100 : 0}
            showsText
            textStyle={{
              fontSize: 10
            }}
            color={colors.accent}
            formatText={progress => (progress * 100).toFixed(0)}
            borderWidth={0}
            thickness={2}
          />
        </TouchableOpacity>
      ) : (
        <ActionIcon
          onPress={() => onPress(attachment)}
          name="download"
          size={SIZE.lg}
          color={colors.pri}
        />
      )}
    </View>
  );
};
