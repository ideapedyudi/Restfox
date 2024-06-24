<template>
    <div class="navbar">
        <div class="heading">
            <img src="/pwa-192x192.png" width="20" height="20" style="margin-right: 5px;">
            <div v-if="!activeWorkspaceLoaded">Workspaces</div>
            <div v-else>
                <a href="#" @click.prevent="setActiveWorkspace(null)">Workspaces</a> > <span>{{ activeWorkspace.name
                    }}</span>
            </div>
            <div style="margin-left: 0.5rem; font-size: 0.6rem"
                v-if="activeWorkspaceLoaded && activeWorkspace._type === 'file'">
                <button class="button" @click="openWorkspaceFolder">Open Folder</button>
            </div>
        </div>
        <div class="right-nav-container">
            <a href="#" @click.prevent="cycleTheme()" class="bl">Theme: {{ getThemeName(theme) }}</a>
            <div v-if="nav === 'collection'" style="height: 100%;">
                <template v-if="activeTab && activeTab._type === 'request'">
                    <a href="#" @click.prevent="requestResponseLayout = 'top-bottom'"
                        v-if="requestResponseLayout === 'left-right'" class="bl">View: Column</a>
                    <a href="#" @click.prevent="requestResponseLayout = 'left-right'" v-else class="bl">View: Row</a>
                </template>
                <div style="display: inline-flex; align-items: center; height: 100%; margin-right: 0.5rem;">
                    <a href="#" @click.prevent="environmentModalShow = true"
                        style="margin-right: 0.2rem; padding-right: 0.2rem;" class="bl">Environment</a>
                    <select v-model="currentEnvironment"
                        style="border: 1px solid var(--default-border-color); outline: 0; background-color: inherit; height: 84%; border-radius: var(--default-border-radius)"
                        title="Change Environment">
                        <option v-for="environment in environments">{{ environment.name }}</option>
                    </select>
                </div>
                <!-- <a href="#" @click.prevent="showImportModal" class="bl">Import</a>
                <a href="#" @click.prevent="exportCollection" class="bl">Export</a> -->
            </div>
            <template v-if="nav === 'workspaces'">
                <a href="#" @click.prevent="showAddWorkspace" class="bl">Add Workspace</a>
                <a href="#" @click.prevent="openFileWorkspace" class="bl" title="Open an existing file workspace"
                    v-if="flags.isElectron">Open File Workspace</a>
                <a href="#" @click.prevent="backupAndRestore" class="bl">Backup & Restore</a>
            </template>
            <!-- <a href="#" @click.prevent="showPluginsManager" class="bl">Plugins</a> -->
            <a href="#" @click.prevent="showSettings" class="bl br">Settings</a>
            <a href="#" @click.prevent="showLogs" class="bl br">Logs</a>
            <span class="spacer"></span>
            <div>
                <p>Restfox, EDIfly Team 💡🧑‍💻😎</p>
            </div>
        </div>
    </div>
    <PluginManagerModal v-model:showModal="showPluginManagerModal" />
    <AddWorkspaceModal v-model:showModal="showAddWorkspaceModal" :is-electron="flags.isElectron" />
    <SettingsModal v-model:showModal="showSettingsModal" />
    <LogsModal v-model:showModal="showLogsModal"></LogsModal>
    <EnvironmentModal v-model:showModal="environmentModalShow" :workspace="activeWorkspace" v-if="activeWorkspace" />
    <BackupAndRestoreModal />
</template>

<script>
import PluginManagerModal from './modals/PluginManagerModal.vue'
import AddWorkspaceModal from './modals/AddWorkspaceModal.vue'
import SettingsModal from './modals/SettingsModal.vue'
import EnvironmentModal from './modals/EnvironmentModal.vue'
import BackupAndRestoreModal from './modals/BackupAndRestoreModal.vue'
import LogsModal from './modals/LogsModal.vue'
import { exportRestfoxCollection, applyTheme, generateNewIdsForTree, toTree } from '@/helpers'
import { getCollectionForWorkspace } from '@/db'
import constants from '../constants'

export default {
    components: {
        PluginManagerModal,
        AddWorkspaceModal,
        SettingsModal,
        EnvironmentModal,
        BackupAndRestoreModal,
        LogsModal
    },
    props: {
        nav: String
    },
    data() {
        return {
            showSettingsModal: false,
            showPluginManagerModal: false,
            showAddWorkspaceModal: false,
            environmentModalShow: false,
            showLogsModal: false,
        }
    },
    computed: {
        activeWorkspace() {
            return this.$store.state.activeWorkspace
        },
        activeWorkspaceLoaded() {
            return this.$store.state.activeWorkspaceLoaded
        },
        environments() {
            return this.activeWorkspace.environments ?? [
                {
                    name: 'Default',
                    environment: this.activeWorkspace.environment
                }
            ]
        },
        currentEnvironment: {
            get() {
                return this.activeWorkspace.currentEnvironment ?? 'Default'
            },
            set(value) {
                this.activeWorkspace.currentEnvironment = value
                this.$store.commit('updateWorkspaceCurrentEnvironment', {
                    workspaceId: this.activeWorkspace._id,
                    currentEnvironment: value
                })
                const selectedEnvironment = this.environments.find(environmentItem => environmentItem.name === value)
                this.activeWorkspace.environment = selectedEnvironment.environment
                this.$store.commit('updateWorkspaceEnvironment', {
                    workspaceId: this.activeWorkspace._id,
                    environment: selectedEnvironment.environment
                })
            }
        },
        requestResponseLayout: {
            get() {
                return this.$store.state.requestResponseLayout
            },
            set(value) {
                this.$store.state.requestResponseLayout = value
                localStorage.setItem(constants.LOCAL_STORAGE_KEY.REQUEST_RESPONSE_LAYOUT, value)
            }
        },
        theme: {
            get() {
                return this.$store.state.theme
            },
            set(value) {
                this.$store.state.theme = value
                localStorage.setItem(constants.LOCAL_STORAGE_KEY.THEME, value)
                applyTheme(value)
            }
        },
        githubStarCount() {
            return this.$store.state.githubStarCount
        },
        activeTab() {
            return this.$store.state.activeTab
        },
        flags() {
            return this.$store.state.flags
        },
    },
    methods: {
        async exportCollection() {
            let { collection } = await getCollectionForWorkspace(this.activeWorkspace._id)
            for (const item of collection) {
                item.plugins = this.$store.state.plugins.workspace.filter(plugin => plugin.collectionId === item._id)
            }

            // if the workspace is a file workspace, we need to generate new ids for the collection
            // as ids are just file paths in the case of file workspaces
            // we don't want to leak the file paths in the exported collection
            if (this.activeWorkspace._type === 'file') {
                const collectionTree = toTree(collection)
                generateNewIdsForTree(collectionTree)
                collection = collectionTree
            }

            exportRestfoxCollection(collection, this.activeWorkspace.environments)
        },
        setActiveWorkspace(workspace) {
            this.$store.commit('setActiveWorkspace', workspace)
        },
        showSettings() {
            this.showSettingsModal = true
        },
        showLogs() {
            this.showLogsModal = true
        },
        showPluginsManager() {
            this.showPluginManagerModal = true
        },
        showAddWorkspace() {
            this.showAddWorkspaceModal = true
        },
        showImportModal() {
            this.$store.commit('showImportModalSelectedRequestGroupId', null)
            this.$store.commit('showImportModal', true)
        },
        backupAndRestore() {
            this.$store.commit('showBackupAndRestoreModal', true)
        },
        async openWorkspaceFolder() {
            await window.electronIPC.openFolder(this.activeWorkspace.location)
        },
        async openFileWorkspace() {
            const selectedFolderPath = await window.electronIPC.openFolderSelectionDialog()
            if (selectedFolderPath) {
                try {
                    const workspace = await window.electronIPC.getWorkspaceAtLocation(selectedFolderPath)
                    const existingWorkspace = this.$store.state.workspaces.find(workspaceItem => workspaceItem.location === selectedFolderPath)
                    if (existingWorkspace) {
                        console.log(existingWorkspace)
                        this.setActiveWorkspace(existingWorkspace)
                    } else {
                        this.$store.dispatch('createWorkspace', {
                            name: workspace.name,
                            _type: 'file',
                            location: selectedFolderPath,
                            setAsActive: true
                        })
                    }
                } catch (e) {
                    this.$toast.error('No workspace found in the selected folder')
                }
            }
        },
        getThemeName(theme) {
            return theme.charAt(0).toUpperCase() + theme.slice(1)
        },
        cycleTheme() {
            const themes = [
                'light',
                'dark',
                'dracula'
            ]

            const currentIndex = themes.indexOf(this.theme)
            const nextIndex = (currentIndex + 1) % themes.length
            this.theme = themes[nextIndex]
        }
    }
}
</script>

<style scoped>
.navbar {
    padding-left: 1em;
    padding-right: 1em;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 31.5px;
}

.spacer {
    padding-left: 1em;
}

.heading {
    font-weight: 500;
    display: flex;
    align-items: center;
}

.right-nav-container {
    display: flex;
    align-items: center;
    height: 100%;
}

.heading a:not(:hover),
.right-nav-container a {
    text-decoration: none;
}

.right-nav-container a {
    display: inline-flex;
    align-items: center;
    height: 100%;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    color: var(--text-color);
}

.right-nav-container a:hover {
    background-color: var(--border-color-lighter-darkened);
}

.right-nav-container a.bl {
    border-left: 1px solid var(--border-color-lighter);
}

.right-nav-container a.br {
    border-right: 1px solid var(--border-color-lighter);
}

.right-nav-container .gh-button-container {
    border: 1px solid var(--default-border-color);
    border-radius: 0.25em;
    line-height: 14px;
}

.right-nav-container .gh-button-container>svg {
    fill: var(--github-button-icon-fill-color);
}
</style>
