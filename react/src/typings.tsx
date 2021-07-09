/*****   TYPES   *****/
export type Counts = { [key: string]: number };
export type KeyValue = { [key: string]: string };
export type FieldDisplayValueType = string[] | string | number | boolean | null | undefined;

/*****   ENUMS   *****/
export enum PipelineStatus {
    PENDING = "Requested",
    RUNNING = "Running",
    COMPLETED = "Done",
    ERROR = "Error",
    CANCELLED = "Cancelled",
}

export enum AnalysisPriority {
    CLINICAL = "Clinical",
    RESEARCH = "Research",
}

/*****   INTERFACES   *****/
export interface Family {
    family_id: string;
    family_codename: string;
    created: string;
    created_by: number;
    updated: string;
    updated_by: number;
    participants: Participant[];
}

export interface Participant {
    participant_id: string;
    participant_codename: string;
    participant_aliases: string;
    family_id: string;
    family_codename: string;
    family_aliases: string;
    participant_type: string;
    affected: PseudoBoolean;
    solved: PseudoBoolean;
    sex: string;
    notes: string;
    dataset_types: string[];
    created: string;
    created_by: number;
    updated: string;
    updated_by: number;
    tissue_samples: Sample[];
    institution: string;
}
export interface Sample {
    tissue_sample_id: string;
    extraction_date: string;
    tissue_sample_type: string;
    tissue_processing: string;
    datasets: Dataset[];
    notes: string;
    created: string;
    created_by: number;
    updated: string;
    updated_by: number;
}

export interface UnlinkedFile {
    path: string;
    multiplexed?: boolean;
}
export interface LinkedFile extends UnlinkedFile {
    file_id: number;
}

export interface Dataset {
    dataset_id: string;
    participant_codename: string;
    participant_aliases: string;
    family_codename: string;
    family_aliases: string;
    tissue_sample_type: string;
    tissue_sample_id: string;
    dataset_type: string;
    linked_files: LinkedFile[];
    notes: string;
    condition: string;
    extraction_protocol: string;
    capture_kit: string;
    library_prep_method: string;
    library_prep_date: string;
    read_length: number;
    read_type: string;
    sequencing_id: string;
    sequencing_centre: string;
    batch_id: string;
    created: string;
    created_by: number;
    updated: string;
    updated_by: number;
    discriminator: string;
    group_code: string[];
}

// Result from /api/datasets/:id
export interface DatasetDetails {
    tissue_sample: Sample;
    institution: string;
    analyses: Analysis[];
}

export type DatasetDetailed = Dataset & DatasetDetails;

export interface Analysis {
    analysis_id: string;
    analysis_state: PipelineStatus;
    assignee: string;
    dataset_id: string;
    family_codenames: string[];
    finished: string;
    notes: string;
    participant_codenames: string[];
    pipeline: Pipeline;
    pipeline_id: string;
    priority: AnalysisPriority;
    qsubID: string;
    requested: string;
    requester: string;
    result_path: string;
    started: string;
    updated: string;
    updated_by: number;
}

export interface AnalysisDetails {
    datasets: Dataset[];
}

export type AnalysisDetailed = Analysis & AnalysisDetails;

// Fields that can be changed
export type AnalysisChange = Pick<Analysis, "analysis_id"> &
    Partial<
        Pick<
            Analysis,
            | "analysis_state"
            | "priority"
            | "pipeline_id"
            | "qsubID"
            | "result_path"
            | "assignee"
            | "requested"
            | "notes"
        >
    >;

export interface BlobResponse {
    filename: string;
    blob: Blob;
}
export interface Pipeline {
    pipeline_id: number;
    pipeline_name: string;
    pipeline_version: string;
    supported_types: string[];
}
export interface Info {
    primaryListTitle: string;
    secondaryListTitle?: string;
    fields: Field[];
    collapsibleFields?: Field[];
    identifier?: string;
}

// Define these as classes so that we can create an array of keys later
export class DataEntryRowBase {
    family_codename!: string;
    participant_codename!: string;
    participant_type!: string;
    tissue_sample_type!: string;
    dataset_type!: string;
    condition!: string;
    sequencing_date!: string;
}

export class DataEntryRowOptional {
    sex?: string;
    affected?: boolean;
    solved?: boolean;
    linked_files?: LinkedFile[];
    notes?: string;
    extraction_protocol?: string;
    capture_kit?: string;
    library_prep_method?: string;
    read_length?: number;
    read_type?: string;
    sequencing_id?: string;
    sequencing_centre?: string;
    batch_id?: string;
    institution?: string;
}

// Cannot enforce "RNASeq => these values are set" with types
export class DataEntryRowRNASeq {
    RIN?: string;
    DV200?: string;
    concentration?: string;
    sequencer?: string;
    spike_in?: string;
}

export interface DataEntryRow extends DataEntryRowBase, DataEntryRowOptional, DataEntryRowRNASeq {
    participantColDisabled?: boolean;
}

export interface DataEntryHeader {
    title: string;
    field: keyof DataEntryRow;
    hidden?: boolean;
}

export interface NewUser {
    username: string;
    email: string;
    is_admin: boolean;
    password: string;
    confirmPassword?: string;
    groups: string[]; // Group.group_code
    issuer?: string;
    subject?: string;
}

export interface User {
    username: string;
    email: string;
    is_admin: boolean;
    last_login: string;
    deactivated: boolean;
    groups: string[]; // Group.group_code
    current?: string; // current password
    password?: string;
    confirmPassword?: string;
    minio_access_key?: string;
    minio_secret_key?: string;
    issuer?: string;
    subject?: string;
}

// A logged-in user
export type CurrentUser = Pick<User, "username" | "last_login" | "is_admin" | "groups">;

export interface Group {
    group_code: string;
    group_name: string;
    users?: string[]; // User.username
}

export interface Field {
    title: string;
    value: FieldDisplayValueType;
    fieldName?: string;
    fullWidth?: boolean;
    disableEdit?: boolean;
}

export type PseudoBoolean = "true" | "false" | "null";
export const PseudoBooleanReadableMap: Record<PseudoBoolean, string> = {
    true: "Yes",
    false: "No",
    null: "Unknown",
};
export interface ConfirmPasswordState {
    password: string;
    confirmPassword: string;
}

export interface ConfirmPasswordAction {
    type: "password" | "confirm";
    payload: string;
}

export interface Option {
    title: string;
    inputValue: string;
    origin?: string;
    disabled?: boolean;
    selected?: boolean;
}

export interface GeneAlias {
    ensembl_id: number;
    name: string;
    kind?: string;
}

interface APIInfoBase {
    sha: string;
}

interface APIInfoOAuth {
    oauth: true;
    oauth_provider: string;
}

interface APIInfoNoOauth {
    oauth: false;
}

export type APIInfo = APIInfoBase & (APIInfoOAuth | APIInfoNoOauth);
