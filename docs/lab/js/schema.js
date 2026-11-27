export const classifications = ['NOT_TESTED','PASS','PASS_WITH_LIMITATIONS','FAIL','BLOCKED','INCONCLUSIVE','NOT_APPLICABLE']
export const dimensions = ['http_validation','browser_compatibility','whatsapp_preview_compatibility',
  'native_media_compatibility','autoplay','looping','forwarding','visual_quality']
export const contextFields = ['device_model','operating_system','os_version','whatsapp_version','client_type',
  'browser_name','browser_version','network_type','media_auto_download_setting','data_saver_setting',
  'link_preview_setting','reduced_motion_setting','distribution_context','sender_or_recipient','preview_size']
export const flags = ['preview_generation_attempted','preview_present','correct_asset_displayed',
  'preview_animation_observed','preview_autoplay_observed','play_button_present','manual_playback_supported',
  'native_playback_observed','external_browser_opened','in_app_browser_opened','autoplay_after_opening',
  'audio_present','audio_automatic','loop_observed','forwarding_tested','forwarding_preserved_preview',
  'forwarding_preserved_animation','caption_preserved','url_clickable']
export const numbers = ['loop_count','visual_quality_score','playback_delay_seconds']
export const fields = ['observation_id','test_id','test_version','test_category','asset_sha256','test_timestamp',
  ...contextFields,...flags,...numbers,'result_classification',...dimensions,'notes','evidence_filename']
