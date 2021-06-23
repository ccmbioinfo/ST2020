import React, { useEffect, useState } from "react";
import {
    Button,
    Checkbox,
    Chip,
    Container,
    FormControl,
    Grid,
    InputLabel,
    ListItemText,
    makeStyles,
    MenuItem,
    Select,
    Typography,
} from "@material-ui/core";
import { useSnackbar } from "notistack";
import { snakeCaseToTitle } from "../../functions";
import { useDownloadCsv } from "../../hooks";
import { GeneAlias } from "../../typings";
import GeneAutocomplete from "./Autocomplete";
import { CardButton } from "./CardButton";

interface SearchVariantsPageProps {}

const useStyles = makeStyles(theme => ({
    appBarSpacer: theme.mixins.toolbar,
    content: {
        flexGrow: 1,
        height: "100vh",
        overflow: "auto",
    },
    container: {
        marginTop: theme.spacing(3),
        marginBottom: theme.spacing(3),
    },
    chip: {
        margin: theme.spacing(1),
        paddingTop: theme.spacing(3),
        paddingBottom: theme.spacing(3),
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
    },
    selectChips: {
        display: "flex",
        flexWrap: "wrap",
    },
    selectChip: {
        margin: theme.spacing(0.5),
    },
}));

const GET_VARIANTS_SUMMARY_URL = "/api/summary/variants";

const GET_VARIANTS_BY_PARTICIPANTS_SUMMARY_URL = "/api/summary/participants";

// TODO: Get this list from the backend instead
const temporaryListOfReportColumns = [
    "Position",
    "UCSC_Link",
    "GNOMAD_Link",
    "Ref",
    "Alt",
    "Zygosity.401_130105S",
    "Zygosity.401_13_0451",
    "Gene",
    "Burden.401_130105S",
    "Burden.401_13_0451",
    "gts",
    "Variation",
    "Info",
    "Refseq_change",
    "Depth",
    "Quality",
    "Alt_depths.401_130105S",
    "Alt_depths.401_13_0451",
    "Trio_coverage",
    "Ensembl_gene_id",
    "Gene_description",
    "Omim_gene_description",
    "Omim_inheritance",
    "Orphanet",
    "Clinvar",
    "Frequency_in_C4R",
    "Seen_in_C4R_samples",
    "HGMD_id",
    "HGMD_gene",
    "HGMD_tag",
    "HGMD_ref",
    "Gnomad_af_popmax",
    "Gnomad_af",
    "Gnomad_ac",
    "Gnomad_hom",
    "Ensembl_transcript_id",
    "AA_position",
    "Exon",
    "Protein_domains",
    "rsIDs",
    "Gnomad_oe_lof_score",
    "Gnomad_oe_mis_score",
    "Exac_pli_score",
    "Exac_prec_score",
    "Exac_pnull_score",
    "Conserved_in_20_mammals",
    "Sift_score",
    "Polyphen_score",
    "Cadd_score",
    "Vest3_score",
    "Revel_score",
    "Gerp_score",
    "Imprinting_status",
    "Imprinting_expressed_allele",
    "Pseudoautosomal",
    "Splicing",
    "Number_of_callers",
    "Old_multiallelic",
];

const SearchVariantsPage: React.FC<SearchVariantsPageProps> = () => {
    const loadSavedArray = (key: string) => {
        const stored = localStorage.getItem(key);
        if (stored === null) return [];
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed;
            } else {
                console.warn(`Invalid localStorage format for '${key}'.`, stored);
                localStorage.removeItem(key);
                return [];
            }
        } catch (error) {
            console.warn(`Invalid localStorage format for '${key}'.`, stored);
            localStorage.removeItem(key);
            return [];
        }
    };

    const { enqueueSnackbar } = useSnackbar();

    const [selectedGenes, setSelectedGenes] = useState<GeneAlias[]>(loadSavedArray("gene-panel"));
    const [downloadType, setDownloadType] = useState<"variant" | "participant">("variant");
    const [columns, setColumns] = useState<string[]>(
        (loadSavedArray("report-columns") as string[]).filter(col =>
            temporaryListOfReportColumns.includes(col)
        )
    );

    const updateColumns = (newColumns: string[]) => {
        setColumns(newColumns);
        localStorage.setItem("report-columns", JSON.stringify(newColumns));
    };

    const toggleGeneSelection = (gene: GeneAlias) => {
        const updated = !selectedGenes.includes(gene)
            ? selectedGenes.concat(gene)
            : selectedGenes.filter(g => g !== gene);
        setSelectedGenes(updated);
        localStorage.setItem("gene-panel", JSON.stringify(updated));
    };

    const onError = async (response: Response) => {
        try {
            const payload = await response.json();
            enqueueSnackbar(`${response.status} ${response.statusText}: ${payload.error}`);
        } catch (error) {
            console.error(error, response);
            enqueueSnackbar(`${response.status} ${response.statusText}`);
        }
    };

    const downloadVariantwiseCsv = useDownloadCsv(GET_VARIANTS_SUMMARY_URL, {
        onError,
    });

    const downloadParticipantwiseCsv = useDownloadCsv(GET_VARIANTS_BY_PARTICIPANTS_SUMMARY_URL, {
        onError,
    });

    const downloadCsv = () => {
        const panel = selectedGenes.map(gene => `ENSG${gene.ensembl_id}`).join(",");
        if (downloadType === "participant") {
            return downloadParticipantwiseCsv({ panel });
        }
        return downloadVariantwiseCsv({ panel });
    };

    useEffect(() => {
        document.title = `Search Variants | ${process.env.REACT_APP_NAME}`;
    }, []);

    const classes = useStyles();

    const disableControls = !selectedGenes.length;

    return (
        <main className={classes.content}>
            <div className={classes.appBarSpacer} />
            <Container className={classes.container} maxWidth={false}>
                <Grid spacing={3} direction="column" container alignItems="center">
                    <Grid item xs={12}>
                        <Typography align="center" variant="h3">
                            Search for Variants
                        </Typography>
                    </Grid>
                    <Grid
                        container
                        justify="center"
                        alignItems="center"
                        spacing={1}
                        item
                        xs={12}
                        md={6}
                        wrap="nowrap"
                    >
                        <Grid item xs={12}>
                            <GeneAutocomplete fullWidth={true} onSelect={toggleGeneSelection} />
                        </Grid>
                        <Grid item>
                            <Button
                                disabled={disableControls}
                                onClick={downloadCsv}
                                size="large"
                                variant="contained"
                            >
                                Download
                            </Button>
                        </Grid>
                    </Grid>
                    <Grid container item xs={12} md={6} spacing={1}>
                        <Grid container item xs={6}>
                            <CardButton
                                title="Variant-wise Report"
                                description="Each row is identified by a unique variant. If multiple participants have the same variant, column fields such as codename, depth, or zygosity are concatenated into a single list -- delimited by ';' -- for that variant's row."
                                selected={downloadType === "variant"}
                                onClick={() => setDownloadType("variant")}
                                disabled={disableControls}
                            />
                        </Grid>
                        <Grid container item xs={6}>
                            <CardButton
                                title="Participant-wise Report"
                                description="Each row is identified by a participant's variant. Every column field is a single value, and variants may occur more than once if more than one participant has that variant."
                                selected={downloadType === "participant"}
                                onClick={() => setDownloadType("participant")}
                                disabled={disableControls}
                            />
                        </Grid>
                        {process.env.NODE_ENV === "development" && (
                            // TODO: Remove dev-only rendering when endpoint is updated to accept report columns
                            <Grid item xs={12}>
                                <FormControl fullWidth>
                                    <InputLabel>Columns included in Report</InputLabel>
                                    <Select
                                        multiple
                                        value={columns}
                                        onChange={e => updateColumns(e.target.value as string[])}
                                        renderValue={selected => (
                                            <div className={classes.selectChips}>
                                                {(selected as string[]).map(column => (
                                                    <Chip
                                                        key={column}
                                                        label={snakeCaseToTitle(column)}
                                                        className={classes.selectChip}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    >
                                        {temporaryListOfReportColumns.map(column => (
                                            <MenuItem key={column} value={column}>
                                                <Checkbox checked={columns.includes(column)} />
                                                <ListItemText primary={snakeCaseToTitle(column)} />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        )}
                    </Grid>
                    <Grid container item xs={12} md={6} wrap="nowrap">
                        <Grid item>
                            {!!selectedGenes.length && <Typography>Selected Genes</Typography>}
                        </Grid>
                        <Grid item container xs={12}>
                            {selectedGenes.map(g => (
                                <Grid item key={g.name}>
                                    <Chip
                                        className={classes.chip}
                                        label={
                                            <>
                                                <b>{g.name}</b>
                                                <br />
                                                <small>
                                                    ENSG{`${g.ensembl_id}`.padStart(11, "0")}
                                                </small>
                                            </>
                                        }
                                        onDelete={() => toggleGeneSelection(g)}
                                    />
                                </Grid>
                            ))}
                        </Grid>
                    </Grid>
                </Grid>
            </Container>
        </main>
    );
};

export default SearchVariantsPage;
